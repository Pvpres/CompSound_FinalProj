let rave = "samples('github:mot4i/garden')\nsamples('github:todepond/dirt-samples')\nsamples('github:todepond/spicule')\
\n \nsetcpm(130/4)\
\n$: sound(\"bd:8(4,8)\")\
\n.lpf(600)\
\n.bank(\"garden\")\
\n.duck(1).orbit(2).duckattack(0.2)\
\n\
\n$: s(\"airhorn\")\
\n.chop(8)\
\n.clip(0.5)\
\n.speed(0.5)\
\n.room(0.5)\
\n.sometimes(ply(2))\
\n\
\n $: note(\"g1 g1 -\")\
\n.steps(8)\
\n.clip(2)\
\n.fm(1)\
\n.fmh(2.01)\
\n.room(.8)\
\n.size(8)\
\n.lpf(8000)\
\n.lpq(20)\
\n.s(\"saw\")\
\n.transpose(\"0,7\")\
\n\n\
//all(x=>x.lpf(5000).hpf(500))";