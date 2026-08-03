# Parse gongche semantics only from `gc.raw`

Within a reviewed gongche source, `gc.raw` is the converter's sole semantic input; flattened fields such as `b`, `r`, `p`, `bt`, `o`, and `q` may only support compatibility and consistency diagnostics. Although the flattened fields are easier to consume, using them to generate score facts would silently discard ordering, grouping, and unknown notation that remains present in the original expression.
