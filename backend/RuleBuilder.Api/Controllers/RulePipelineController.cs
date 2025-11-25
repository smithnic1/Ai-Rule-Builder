using Microsoft.AspNetCore.Mvc;
using RuleBuilder.Api.Services;

namespace RuleBuilder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RulePipelineController(AiService ai) : ControllerBase
{
    private readonly AiService _ai = ai ?? throw new ArgumentNullException(nameof(ai));

    [HttpPost("extract")]
    public async Task<IActionResult> Extract([FromBody] InputDto? dto, CancellationToken cancellationToken)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Text))
        {
            return BadRequest("Text is required.");
        }

        var result = await _ai.ExtractRulePipeline(dto.Text, cancellationToken);
        return Ok(new { result });
    }

    public record InputDto(string Text);
}
