const flightRadio = (() => {
  const $ = (id) => document.getElementById(id);
  const button = $("intelButton"),
    text = $("radioText"),
    source = $("radioSource");
  const load = async (path) => {
    const reply = await fetch(path);
    if (!reply.ok) throw new Error("Archive unavailable");
    return reply.json();
  };
  let sectors = [],
    archive = [],
    revision = 0,
    current = null,
    live = false;
  const ready = Promise.all([
    load("sectors.json")
      .then((data) => (sectors = data))
      .catch(() => {}),
    load("transmissions.json")
      .then((data) => (archive = data.sectors || []))
      .catch(() => {}),
    location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? load("api/status")
          .then((data) => (live = data.live === true))
          .catch(() => {})
      : Promise.resolve(),
  ]).then(() => {
    if (current) reset(current);
  });

  function snapshot(s) {
    return {
      stage: s.stage,
      lives: s.lives,
      score: s.score,
      accuracy: s.shotsFired ? Math.round((100 * s.shotsHit) / s.shotsFired) : 0,
      shots: s.shotsFired,
      remaining: s.enemies.filter((e) => e.alive).length,
      phase: s.mode === "diploma" ? (s.lastDiplomaRecord?.victory ? "victory" : "loss") : s.mode,
    };
  }
  function transmission(data, requested = false) {
    const sector = sectors[data.stage - 1],
      pack = archive[data.stage - 1];
    const kind = ["victory", "loss", "intermission"].includes(data.phase)
      ? "debrief"
      : data.phase === "playing" && data.lives === 1
        ? "damage"
        : (requested && data.phase === "playing") || (data.shots >= 5 && data.accuracy < 40)
          ? "aim"
          : "brief";
    const saved = pack?.[kind];
    const local =
      kind === "damage"
        ? "One interceptor left. Use surviving shield material between volleys."
        : kind === "debrief"
          ? "Flight record received. Review the wave, your remaining hulls and your shot accuracy."
          : kind === "aim"
            ? "Lead the nearest crossing target. Keep your firing lane clear of shield material."
            : sector?.hint || "Hold the defense line. Fire down a clear lane.";
    return { message: saved || local, label: saved ? "OpenAI radio archive" : "Onboard archive" };
  }
  function reset(s) {
    current = s;
    revision++;
    button.disabled = false;
    const data = snapshot(s),
      item = transmission(data);
    $("sectorName").textContent = sectors[s.stage - 1]?.name || "Kestrel Station";
    button.textContent =
      data.phase === "loss" || data.phase === "victory" || data.phase === "intermission"
        ? "Request debrief ↗"
        : "Request intel ↗";
    const afterAction = ["victory", "loss", "intermission"].includes(data.phase);
    text.textContent = afterAction ? "Flight record received. Request a debrief when ready." : item.message;
    source.textContent = afterAction ? "Kestrel Station" : item.label;
  }
  async function request(s) {
    await ready;
    const id = ++revision,
      data = snapshot(s),
      item = transmission(data, true);
    if (!live) {
      source.textContent = item.label;
      text.textContent =
        "Wave " +
        data.stage +
        " · " +
        (sectors[data.stage - 1]?.name || "Flight control") +
        ". " +
        item.message;
      return;
    }
    button.disabled = true;
    source.textContent = "Opening uplink";
    text.textContent = "Calling Kestrel flight control…";
    try {
      const reply = await fetch("api/radio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(16000),
      });
      if (!reply.ok) throw new Error("Uplink unavailable");
      const response = await reply.json();
      if (id === revision) {
        text.textContent = response.message;
        source.textContent = "OpenAI · live uplink";
      }
    } catch {
      if (id === revision) {
        text.textContent = item.message;
        source.textContent = "Uplink offline · " + item.label;
      }
    } finally {
      if (id === revision) button.disabled = false;
    }
  }
  return { reset, request };
})();
