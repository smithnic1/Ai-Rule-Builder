using System.Collections.Generic;

namespace RuleBuilder.Api.Models;

public class RuleSchema
{
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
    public List<string> Constraints { get; set; } = new();
    public string? TimeRange { get; set; }
}
