So close... but 
- creates a new function for no good reason
- `get_xbound` returns bounds in order vs. `get_xlim`, although looking at how it's used I'm not sure it actually matters
- I don't think it needs to unpack the output into a list