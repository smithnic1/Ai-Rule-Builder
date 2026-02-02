using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using RuleBuilder.Api.Models;

namespace RuleBuilder.Api.Services;

public class AiService
{
    private readonly Kernel _kernel;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

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

    public async Task<string> ExtractMultipleRules(string text)
    {
        var result = await _kernel.InvokeAsync(
            "MultiRuleExtractor",
            "ExtractRules",
            new() { ["input"] = text });

        var json = result.GetValue<string>()!;

        // Normalize and validate EACH rule
        var doc = JsonDocument.Parse(json);
        var rules = doc.RootElement.GetProperty("rules");

        var fixedRules = new List<string>();

        foreach (var ruleEl in rules.EnumerateArray())
        {
            var ruleJson = ruleEl.GetRawText();

            var normalized = await NormalizeRuleJson(ruleJson);

            var valid = await ValidateRuleJson(normalized);
            if (!valid)
                throw new Exception("One extracted rule is invalid");

            fixedRules.Add(normalized);
        }

        return JsonSerializer.Serialize(new { rules = fixedRules });
    }

    public async Task<string> ClusterRules(string jsonRules, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(jsonRules))
        {
            throw new ArgumentException("A rules payload is required for clustering.", nameof(jsonRules));
        }

        var result = await _kernel.InvokeAsync(
            "RuleBuilder",
            "RuleClusterer",
            new() { ["input"] = jsonRules },
            cancellationToken);

        var payload = result.GetValue<string>();

        if (string.IsNullOrWhiteSpace(payload))
        {
            throw new InvalidOperationException("Rule clustering returned no content.");
        }

        return payload;
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

            var actionValid = TryGetPropertyIgnoreCase(root, "action", out var action)
                && action.ValueKind == JsonValueKind.String
                && !string.IsNullOrWhiteSpace(action.GetString());

            var targetValid = TryGetPropertyIgnoreCase(root, "target", out var target)
                && target.ValueKind == JsonValueKind.String
                && !string.IsNullOrWhiteSpace(target.GetString());

            if (!actionValid || !targetValid)
            {
                return Task.FromResult(false);
            }

            if (!TryGetPropertyIgnoreCase(root, "conditions", out var conditions) || conditions.ValueKind != JsonValueKind.Array)
            {
                return Task.FromResult(false);
            }

            foreach (var condition in conditions.EnumerateArray())
            {
                if (condition.ValueKind != JsonValueKind.Object)
                {
                    return Task.FromResult(false);
                }

                if (!TryGetPropertyIgnoreCase(condition, "field", out var field)
                    || field.ValueKind != JsonValueKind.String
                    || string.IsNullOrWhiteSpace(field.GetString()))
                {
                    return Task.FromResult(false);
                }

                if (!TryGetPropertyIgnoreCase(condition, "operator", out var op)
                    || op.ValueKind != JsonValueKind.String
                    || string.IsNullOrWhiteSpace(op.GetString()))
                {
                    return Task.FromResult(false);
                }

                if (!TryGetPropertyIgnoreCase(condition, "value", out var value)
                    || value.ValueKind != JsonValueKind.String
                    || string.IsNullOrWhiteSpace(value.GetString()))
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

        // Fallback: if core fields are empty, retry using the original text only.
        if (HasMissingCoreFields(normalized))
        {
            var fallbackIntent = await ExtractRuleIntent(text, cancellationToken);
            normalized = await NormalizeRuleJson(fallbackIntent, cancellationToken);
        }

        // Fill any remaining gaps with simple heuristics based on the original text.
        normalized = FillMissingFields(normalized, text);

        if (HasMissingCoreFields(normalized))
        {
            throw new InvalidOperationException("Rule JSON is missing required fields after repair.");
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

    public async Task<string> AssistRuleJson(string json)
    {
        var result = await _kernel.InvokeAsync("RuleBuilder", "AiAssistPrompt",
            new() { ["input"] = json });

        var improved = result.GetValue<string>()!;

        // Self-repair and validation:
        improved = await NormalizeRuleJson(improved);

        var valid = await ValidateRuleJson(improved);
        if (!valid)
            throw new Exception("Result failed validation");

        return improved;
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

    private static bool HasMissingCoreFields(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return true;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var actionMissing = !TryGetPropertyIgnoreCase(root, "action", out var actionProperty)
                || actionProperty.ValueKind != JsonValueKind.String
                || string.IsNullOrWhiteSpace(actionProperty.GetString());

            var targetMissing = !TryGetPropertyIgnoreCase(root, "target", out var targetProperty)
                || targetProperty.ValueKind != JsonValueKind.String
                || string.IsNullOrWhiteSpace(targetProperty.GetString());

            var conditionsMissing = !TryGetPropertyIgnoreCase(root, "conditions", out var conditionsProperty)
                || conditionsProperty.ValueKind != JsonValueKind.Array
                || !conditionsProperty.EnumerateArray().Any(element =>
                    element.ValueKind == JsonValueKind.Object &&
                    TryGetPropertyIgnoreCase(element, "field", out var fieldProp) &&
                    fieldProp.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(fieldProp.GetString()) &&
                    TryGetPropertyIgnoreCase(element, "operator", out var operatorProp) &&
                    operatorProp.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(operatorProp.GetString()) &&
                    TryGetPropertyIgnoreCase(element, "value", out var valueProp) &&
                    valueProp.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(valueProp.GetString()));

            return actionMissing || targetMissing || conditionsMissing;
        }
        catch (JsonException)
        {
            return true;
        }
    }

    private static string FillMissingFields(string json, string sourceText)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return json;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var actionValue = TryGetPropertyIgnoreCase(root, "action", out var actionProperty) && actionProperty.ValueKind == JsonValueKind.String
                ? actionProperty.GetString()
                : null;

            var targetValue = TryGetPropertyIgnoreCase(root, "target", out var targetProperty) && targetProperty.ValueKind == JsonValueKind.String
                ? targetProperty.GetString()
                : null;

            string? timeRangeValue = null;
            if (TryGetPropertyIgnoreCase(root, "timeRange", out var timeRangeProperty))
            {
                timeRangeValue = timeRangeProperty.ValueKind == JsonValueKind.String ? timeRangeProperty.GetString() : null;
            }

            var priorityValue = 1;
            if (TryGetPropertyIgnoreCase(root, "priority", out var priorityProperty))
            {
                if (priorityProperty.ValueKind == JsonValueKind.Number && priorityProperty.TryGetInt32(out var parsedPriority))
                {
                    priorityValue = parsedPriority;
                }
                else if (priorityProperty.ValueKind == JsonValueKind.String
                         && int.TryParse(priorityProperty.GetString(), out var parsedPriorityFromString))
                {
                    priorityValue = parsedPriorityFromString;
                }
            }

            var logicValue = "AND";
            if (TryGetPropertyIgnoreCase(root, "logic", out var logicProperty) && logicProperty.ValueKind == JsonValueKind.String)
            {
                var raw = logicProperty.GetString();
                if (!string.IsNullOrWhiteSpace(raw))
                {
                    logicValue = raw.Trim().ToUpperInvariant() == "OR" ? "OR" : "AND";
                }
            }

            var rule = new RuleSchema
            {
                Action = actionValue?.Trim() ?? string.Empty,
                Target = targetValue?.Trim() ?? string.Empty,
                TimeRange = string.IsNullOrWhiteSpace(timeRangeValue) ? null : timeRangeValue.Trim(),
                Priority = priorityValue,
                Logic = logicValue,
                Conditions = new List<Condition>()
            };

            if (TryGetPropertyIgnoreCase(root, "conditions", out var conditionsProperty)
                && conditionsProperty.ValueKind == JsonValueKind.Array)
            {
                foreach (var conditionElement in conditionsProperty.EnumerateArray())
                {
                    if (conditionElement.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var field = TryGetPropertyIgnoreCase(conditionElement, "field", out var fieldProperty)
                                && fieldProperty.ValueKind == JsonValueKind.String
                        ? fieldProperty.GetString() ?? string.Empty
                        : string.Empty;

                    var op = TryGetPropertyIgnoreCase(conditionElement, "operator", out var opProperty)
                             && opProperty.ValueKind == JsonValueKind.String
                        ? opProperty.GetString() ?? string.Empty
                        : string.Empty;

                    var value = TryGetPropertyIgnoreCase(conditionElement, "value", out var valueProperty)
                                && valueProperty.ValueKind == JsonValueKind.String
                        ? valueProperty.GetString() ?? string.Empty
                        : string.Empty;

                    var trimmedField = field.Trim();
                    var trimmedOp = op.Trim();
                    var trimmedValue = value.Trim();

                    if (string.IsNullOrWhiteSpace(trimmedField)
                        || string.IsNullOrWhiteSpace(trimmedOp)
                        || string.IsNullOrWhiteSpace(trimmedValue))
                    {
                        continue;
                    }

                    rule.Conditions.Add(new Condition { Field = trimmedField, Operator = trimmedOp, Value = trimmedValue });
                }
            }

            if (string.IsNullOrWhiteSpace(rule.Action))
            {
                rule.Action = InferActionFromText(sourceText);
            }

            if (string.IsNullOrWhiteSpace(rule.Target))
            {
                rule.Target = InferTargetFromText(sourceText);
            }

            if (rule.Conditions.Count == 0)
            {
                rule.Conditions.AddRange(InferConditionsFromText(sourceText));
            }

            // If no usable conditions were found even after inference, keep a generic catch-all to satisfy validation.
            if (rule.Conditions.Count == 0)
            {
                rule.Conditions.Add(new Condition
                {
                    Field = "context",
                    Operator = "contains",
                    Value = sourceText.Trim()
                });
            }

            return JsonSerializer.Serialize(rule, JsonOptions);
        }
        catch (JsonException)
        {
            return json;
        }
    }

    private static string InferActionFromText(string text)
    {
        var lower = text.ToLowerInvariant();

        if (lower.Contains("off"))
        {
            return "grant_time_off";
        }

        if (ContainsAny(lower, "notify", "alert", "inform", "email", "message"))
        {
            return "notify";
        }

        if (ContainsAny(lower, "deny", "reject", "block", "prevent", "forbid"))
        {
            return "deny";
        }

        if (ContainsAny(lower, "schedule", "assign", "book", "arrange", "plan", "reserve"))
        {
            return "schedule";
        }

        if (ContainsAny(lower, "call", "contact"))
        {
            return "contact";
        }

        if (ContainsAny(lower, "approve", "allow", "grant", "get", "give", "offer"))
        {
            return "grant";
        }

        return "apply_policy";
    }

    private static string InferTargetFromText(string text)
    {
        var lower = text.ToLowerInvariant();

        foreach (var (keyword, target) in new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                 {
                     ["employee"] = "employee",
                     ["employees"] = "employees",
                     ["crew"] = "crew",
                     ["crew member"] = "crew_member",
                     ["crewmember"] = "crew_member",
                     ["crewmembers"] = "crew_member",
                     ["staff"] = "staff",
                     ["user"] = "user",
                     ["users"] = "users",
                     ["customer"] = "customer",
                     ["customers"] = "customers",
                     ["member"] = "member",
                     ["members"] = "members",
                     ["people"] = "people",
                     ["person"] = "person",
                     ["sailor"] = "sailor",
                     ["sailors"] = "sailors",
                     ["deckhand"] = "deckhand",
                     ["deckhands"] = "deckhands"
                 })
        {
            if (lower.Contains(keyword))
            {
                return target;
            }
        }

        return "subject";
    }

    private static IReadOnlyCollection<Condition> InferConditionsFromText(string text)
    {
        var lower = text.ToLowerInvariant();
        var conditions = new List<Condition>();

        foreach (var day in new[] { "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" })
        {
            if (lower.Contains(day))
            {
                conditions.Add(new Condition
                {
                    Field = "day_of_week",
                    Operator = "equals",
                    Value = day
                });
            }
        }

        var hoursPattern = @"(?:over|more than|greater than|above|exceeds|exceeding|worked\s+(?:over|more than)|>\s*)(\d{1,4})\s*hours?";
        var hoursMatch = Regex.Match(lower, hoursPattern);
        if (hoursMatch.Success)
        {
            conditions.Add(new Condition
            {
                Field = "hours_worked",
                Operator = "greater_than",
                Value = hoursMatch.Groups[1].Value
            });
        }

        return conditions;
    }

    private static bool ContainsAny(string value, params string[] keywords)
    {
        foreach (var keyword in keywords)
        {
            if (value.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement element, string name, out JsonElement value)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            value = default;
            return false;
        }

        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }
    public record RuleValidationResult(bool Valid, IReadOnlyList<string> Issues);
}
