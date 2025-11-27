using System.Collections.Generic;

namespace RuleBuilder.Api.Models;

public class RuleSchema
{
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
    public List<Condition> Conditions { get; set; } = new();
    public string? TimeRange { get; set; }
    public int Priority { get; set; } = 1;
    public string Logic { get; set; } = "AND"; // AND / OR
}

public class Condition
{
    public string Field { get; set; } = "";
    public string Operator { get; set; } = ""; // equals, greater_than, contains
    public string Value { get; set; } = "";
}
