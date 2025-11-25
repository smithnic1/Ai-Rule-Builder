using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace RuleBuilder.Api.Services;

public class AiService
{
    private readonly Kernel _kernel;

    public AiService(string apiKey, string modelId = "gpt-4o-mini")
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

    public async Task<string> ExtractRulePipeline(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Text is required for the rule pipeline.", nameof(text));
        }

        var summary = await Summarize(text, cancellationToken);
        var intentJson = await ExtractRuleIntent(summary, cancellationToken);

        return intentJson;
    }
}
