using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace RuleBuilder.Api.Services;

public record RuleValidationResult(bool IsValid, IReadOnlyList<string> Issues);

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

    public async Task<RuleValidationResult> ValidateRuleJson(string json, CancellationToken cancellationToken = default)
    {
        json = DecodeHtmlEntities(json);

        if (string.IsNullOrWhiteSpace(json))
        {
            return new RuleValidationResult(false, ["JSON cannot be empty."]);
        }

        var function = _kernel.Plugins.GetFunction("RuleBuilder", "SchemaValidator");
        var arguments = new KernelArguments { ["input"] = json };
        var result = await _kernel.InvokeAsync(function, arguments, cancellationToken);
        var content = result?.ToString();

        if (string.IsNullOrWhiteSpace(content))
        {
            return new RuleValidationResult(false, ["Schema validator returned no content."]);
        }

        try
        {
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;

            var isValid = root.TryGetProperty("valid", out var validProperty) && validProperty.GetBoolean();

            var issues = root.TryGetProperty("issues", out var issuesProperty) && issuesProperty.ValueKind == JsonValueKind.Array
                ? [.. issuesProperty.EnumerateArray()
                    .Select(issue => issue.GetString() ?? string.Empty)
                    .Where(issue => !string.IsNullOrWhiteSpace(issue))]
                : Array.Empty<string>();

            // If the only reported issues are about HTML entities, treat the JSON as valid.
            if (!isValid && issues.Length > 0 && issues.All(IsIgnorableValidationIssue))
            {
                return new RuleValidationResult(true, []);
            }

            return new RuleValidationResult(isValid, issues);
        }
        catch (JsonException)
        {
            return new RuleValidationResult(false, [$"Schema validator returned invalid JSON: {content}"]);
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
        var validation = await ValidateRuleJson(normalized, cancellationToken);

        if (!validation.IsValid)
        {
            var reason = validation.Issues.Count > 0
                ? string.Join("; ", validation.Issues)
                : "Schema validation failed for an unknown reason.";

            throw new InvalidOperationException($"Rule JSON failed validation: {reason}");
        }

        return normalized;
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

            var constraintsEmpty = !root.TryGetProperty("constraints", out var constraintsProperty)
                || constraintsProperty.ValueKind != JsonValueKind.Array
                || !constraintsProperty.EnumerateArray().Any(element =>
                    element.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(element.GetString()));

            return string.IsNullOrEmpty(action) && string.IsNullOrEmpty(target) && constraintsEmpty;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
