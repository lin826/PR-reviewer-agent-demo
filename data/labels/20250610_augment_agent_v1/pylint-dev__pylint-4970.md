I don't know which one is correct here. 

# Problem statement

I can't understand how the problem statement connects to the PR.

When I run the linter directly with `python -m pylint.checkers.similar --duplicates=0 test_dir/*`, all I see is a simple line printed `TOTAL lines=44 duplicates=0 percent=0.00`.

However, the issue suggests I should instead see "every line of code as duplicate and raises many errors".

# GT

The patch fixes this behavior when running the `symilar` tool directly. Basically, it no longer prints when you pass `--duplicates=0`. As far as I can tell, invoking `symilar` does not read from the `rcfile`.

# Agent submission

Agent submission adds this behavior to both the `symilar` tool and the entry point via pylint. But I don't think pylint even prints anything in this case, since it has 0 duplicates. But it is slightly more efficient.