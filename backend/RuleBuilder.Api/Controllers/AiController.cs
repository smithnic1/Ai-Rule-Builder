using Microsoft.AspNetCore.Mvc;
using RuleBuilder.Api.Services;

namespace RuleBuilder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly AiService _aiService;

    public AiController(AiService aiService)
    {
        _aiService = aiService;
    }

    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] PromptDto dto, CancellationToken cancellationToken)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Prompt))
        {
            return BadRequest("Prompt is required.");
        }

        var reply = await _aiService.GetResponseAsync(dto.Prompt, cancellationToken);
        return Ok(new { response = reply });
    }
}

public record PromptDto(string Prompt);
