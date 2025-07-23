The gt changes `_query_cpu`. In theory this function calculates how many CPUs are available on a given system / runtime env.

The agent submission changes `_cpu_count`. `_cpu_count` calls `_query_cpu` to determine the CPUs available and then takes the min between the CPUs returned by `_query_cpu` and the resources indicated by scheduling affinity / multiprocessing.

I believe the gt is slightly more aligned with the intended organization of `_cpu_count` and `_query_cpu`, as well as being slightly more clear about what's being fixed.