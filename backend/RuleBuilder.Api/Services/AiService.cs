using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace RuleBuilder.Api.Services;

public class AiService
{
    private readonly Kernel _kernel;

    public AiService(string apiKey, string modelId = "gpt-5.1")
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new ArgumentException("An OpenAI API key is required.", nameof(apiKey));
        }

        var pluginsRoot = Path.Combine(AppContext.BaseDirectory, "Plugins");

        if (!Directory.Exists(pluginsRoot))
        {
            throw new InvalidOperationException(
                $"Plugin directory not found at '{pluginsRoot}'. Ensure semantic prompt files are copied to the output.");
        }

        var builder = Kernel.CreateBuilder()
            .AddOpenAIChatCompletion(modelId, apiKey);

        var promptPluginDirectories = Directory.GetDirectories(pluginsRoot);
        if (promptPluginDirectories.Length == 0)
        {
            throw new InvalidOperationException(
                $"No prompt plugins were found under '{pluginsRoot}'. Ensure prompt plugin folders exist.");
        }

        foreach (var pluginDirectory in promptPluginDirectories)
        {
            if (Directory.GetDirectories(pluginDirectory).Length == 0)
            {
                continue;
            }

            builder.Plugins.AddFromPromptDirectory(pluginDirectory);
        }

        _kernel = builder.Build();
    }

    public async Task<string> GetResponseAsync(string prompt, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(prompt))
        {
            throw new ArgumentException("A prompt is required.", nameof(prompt));
        }

        var result = await _kernel.InvokePromptAsync(prompt, cancellationToken: cancellationToken);
        return result?.ToString() ?? string.Empty;
    }

    public async Task<string> SummarizeAsync(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Text is required for summarization.", nameof(text));
        }

        var function = _kernel.Plugins.GetFunction("UtilityPlugin", "SummarizePrompt");
        var arguments = new KernelArguments
        {
            ["input"] = text
        };

        var result = await _kernel.InvokeAsync(function, arguments, cancellationToken);
        return result?.ToString() ?? string.Empty;
    }

    public Task<string> Summarize(string text, CancellationToken cancellationToken = default)
        => SummarizeAsync(text, cancellationToken);

    public async Task<string> ExtractRuleIntent(string naturalLanguage, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(naturalLanguage))
        {
            throw new ArgumentException("Natural language text is required.", nameof(naturalLanguage));
        }

        var function = _kernel.Plugins.GetFunction("RuleBuilder", "IntentExtractor");
        var arguments = new KernelArguments
        {
            ["input"] = naturalLanguage
        };

        var result = await _kernel.InvokeAsync(function, arguments, cancellationToken);
        return result?.ToString() ?? string.Empty;
    }

    public async Task<string> NormalizeRuleJson(string json, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new ArgumentException("JSON is required for normalization.", nameof(json));
        }

        var function = _kernel.Plugins.GetFunction("RuleBuilder", "RepairFunction");
        var arguments = new KernelArguments { ["input"] = json };
        var result = await _kernel.InvokeAsync(function, arguments, cancellationToken);
        var normalized = result?.ToString();

        if (!string.IsNullOrWhiteSpace(normalized))
        {
            normalized = DecodeHtmlEntities(normalized);
        }

        if (!string.IsNullOrWhiteSpace(normalized))
        {
            return normalized;
        }

        return DecodeHtmlEntities(json);
    }

    public Task<bool> ValidateRuleJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Task.FromResult(false);
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("conditions", out var conditions) || conditions.ValueKind != JsonValueKind.Array)
            {
                return Task.FromResult(false);
            }

            foreach (var condition in conditions.EnumerateArray())
            {
                if (condition.ValueKind != JsonValueKind.Object)
                {
                    return Task.FromResult(false);
                }

                if (!condition.TryGetProperty("field", out var field) || field.ValueKind != JsonValueKind.String)
                {
                    return Task.FromResult(false);
                }

                if (!condition.TryGetProperty("operator", out var op) || op.ValueKind != JsonValueKind.String)
                {
                    return Task.FromResult(false);
                }

                if (!condition.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.String)
                {
                    return Task.FromResult(false);
                }
            }

            return Task.FromResult(true);
        }
        catch (JsonException)
        {
            return Task.FromResult(false);
        }
    }

    public async Task<string> ExtractRulePipeline(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Text is required for the rule pipeline.", nameof(text));
        }

        // Step 1: Summarize
        var summary = await Summarize(text, cancellationToken);

        // Step 2: Extract raw intent (use both original text and summary for better grounding)
        var combined = $"Original:\n{text}\n\nSummary:\n{summary}";
        var intentJson = await ExtractRuleIntent(combined, cancellationToken);

        // Step 3: Repair JSON if malformed
        var normalized = await NormalizeRuleJson(intentJson, cancellationToken);

        // Fallback: if both action and target are empty, retry using the original text only.
        if (HasEmptyCoreFields(normalized))
        {
            var fallbackIntent = await ExtractRuleIntent(text, cancellationToken);
            normalized = await NormalizeRuleJson(fallbackIntent, cancellationToken);
        }

        // Step 4: Validate
        var validation = await ValidateRuleJson(normalized);

        if (!validation)
        {
            throw new InvalidOperationException("Rule JSON failed validation");
        }

        return normalized;
    }

    public async Task<string> RefineRuleJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new ArgumentException("JSON is required for refinement.", nameof(json));
        }

        // First repair any structural issues
        var repaired = await NormalizeRuleJson(json);

        // Refine the repaired JSON
        var result = await _kernel.InvokeAsync("RuleBuilder", "RefinePrompt",
            new() { ["input"] = repaired });

        var refined = result.GetValue<string>();

        if (string.IsNullOrWhiteSpace(refined))
        {
            throw new InvalidOperationException("Refinement returned empty JSON.");
        }

        // Validate final output
        var validation = await ValidateRuleJson(refined);

        if (!validation)
        {
            throw new InvalidOperationException("Rule JSON failed validation");
        }

        return refined;
    }

    public async Task<RuleValidationResult> ValidateRuleWithSk(string json, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new ArgumentException("JSON is required for validation.", nameof(json));
        }

        var function = _kernel.Plugins.GetFunction("RuleBuilder", "SchemaValidator");
        var arguments = new KernelArguments { ["input"] = json };
        var response = await _kernel.InvokeAsync(function, arguments, cancellationToken);
        var payload = response?.ToString();

        if (string.IsNullOrWhiteSpace(payload))
        {
            return new RuleValidationResult(false, new[] { "Validator returned an empty response." });
        }

        try
        {
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            var valid = root.TryGetProperty("valid", out var validElement) && validElement.GetBoolean();
            var issues = new List<string>();

            if (root.TryGetProperty("issues", out var issuesElement) && issuesElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var issue in issuesElement.EnumerateArray())
                {
                    if (issue.ValueKind == JsonValueKind.String)
                    {
                        var message = issue.GetString();
                        if (!string.IsNullOrWhiteSpace(message))
                        {
                            issues.Add(message);
                        }
                    }
                }
            }

            return new RuleValidationResult(valid, issues);
        }
        catch (JsonException)
        {
            return new RuleValidationResult(false, new[] { "Validator returned unparseable output." });
        }
    }

    public async Task<string> ExplainRuleAsync(string json, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new ArgumentException("JSON is required for explanation.", nameof(json));
        }

        var function = _kernel.Plugins.GetFunction("RuleBuilder", "RuleExplainer");
        var response = await _kernel.InvokeAsync(function, new KernelArguments { ["input"] = json }, cancellationToken);
        var explanation = response?.ToString();

        if (string.IsNullOrWhiteSpace(explanation))
        {
            throw new InvalidOperationException("Rule explanation returned no content.");
        }

        return explanation.Trim();
    }

    private static string DecodeHtmlEntities(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var current = value;
        string previous;

        do
        {
            previous = current;
            current = WebUtility.HtmlDecode(previous);
        } while (!string.Equals(previous, current, StringComparison.Ordinal));

        return current.Trim();
    }

    private static bool IsIgnorableValidationIssue(string issue)
    {
        if (string.IsNullOrWhiteSpace(issue))
        {
            return false;
        }

        return issue.Contains("HTML entities", StringComparison.OrdinalIgnoreCase)
            || issue.Contains("&quot;", StringComparison.OrdinalIgnoreCase)
            || issue.Contains("invalid characters", StringComparison.OrdinalIgnoreCase)
            || issue.Contains("not properly formatted", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasEmptyCoreFields(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return true;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var action = root.TryGetProperty("action", out var actionProperty)
                ? actionProperty.GetString()?.Trim()
                : null;

            var target = root.TryGetProperty("target", out var targetProperty)
                ? targetProperty.GetString()?.Trim()
                : null;

            var conditionsEmpty = !root.TryGetProperty("conditions", out var conditionsProperty)
                || conditionsProperty.ValueKind != JsonValueKind.Array
                || !conditionsProperty.EnumerateArray().Any(element =>
                    element.ValueKind == JsonValueKind.Object &&
                    element.TryGetProperty("value", out var valueProp) &&
                    !string.IsNullOrWhiteSpace(valueProp.GetString()));

            return string.IsNullOrEmpty(action) && string.IsNullOrEmpty(target) && conditionsEmpty;
        }
        catch (JsonException)
        {
            return false;
        }
    }
    public record RuleValidationResult(bool Valid, IReadOnlyList<string> Issues);
}
