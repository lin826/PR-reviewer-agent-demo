# Ground truth issues

Gold patch seems wrong: see PR discussion, and also the follow up:

https://github.com/matplotlib/matplotlib/pull/14643

I'm not even sure the follow up is correct, since it only updates `set_xlim3d` in `lib/mpl_toolkits/mplot3d/axes3d.py` (without `set_ylim3d` and `set_zlim3d`).

It looks like at some point, they refactored everything to use one `_set_lim` function, which avoids the duplicated logic:

https://github.com/anntzer/matplotlib/blob/b2e8b936e057ffc7b0d1505c5703988172041d4b/lib/matplotlib/axis.py#L1200

# Agent

To be honest, apart fom having too many comments, I can't tell if this might be an OK way to fix the problem.

There are 10 instances where `vmax` and `vmin` are inverted in `lib/matplotlib/ticker.py`, and the agent has only restored them in 2 places.