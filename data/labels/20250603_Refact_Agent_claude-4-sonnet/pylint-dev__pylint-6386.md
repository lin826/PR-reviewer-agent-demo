Agent submission does not fix the following behavior, as explained in the issue discussion:

    Just to add to the discussion, the pylint -h shows the following which I think we would want to update to remove the VERBOSE which indicates an argument is expected:

    --verbose VERBOSE, -v VERBOSE
                            In verbose mode, extra non-checker-related info will be displayed.

> Added the option to specify metavar for _CallableArgument. That should fix it!

https://github.com/pylint-dev/pylint/pull/6386#issuecomment-1102288022