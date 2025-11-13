using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace RuleBuilder.Api.Services;

public class AiService
{
    private readonly Kernel _kernel;

    public AiService(string apiKey, string modelId = "gpt-3.5-turbo")
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new ArgumentException("An OpenAI API key is required.", nameof(apiKey));
        }

        var builder = Kernel.CreateBuilder()
            .AddOpenAIChatCompletion(modelId, apiKey);

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
}
