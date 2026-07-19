"""
Multi-Stage Forensic Analysis Pipeline

Implements:
- Sliding window attack chain detection
- Anti-forensics heuristic detection
- MITRE ATT&CK technique mapping
- Predicted next step inference
"""

from typing import List, Dict, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import deque


class AttackPhase(str, Enum):
    INITIAL_ACCESS = "initial_access"
    EXECUTION = "execution"
    PERSISTENCE = "persistence"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    DEFENSE_EVASION = "defense_evasion"
    CREDENTIAL_ACCESS = "credential_access"
    DISCOVERY = "discovery"
    LATERAL_MOVEMENT = "lateral_movement"
    COLLECTION = "collection"
    EXFILTRATION = "exfiltration"
    IMPACT = "impact"


# MITRE ATT&CK Technique Mapping
MITRE_TECHNIQUES: Dict[str, Dict[str, str]] = {
    "T1059.001": {"name": "PowerShell", "tactic": "execution"},
    "T1059.003": {"name": "Windows Command Shell", "tactic": "execution"},
    "T1547.001": {"name": "Registry Run Keys", "tactic": "persistence"},
    "T1053.005": {"name": "Scheduled Task", "tactic": "persistence"},
    "T1055": {"name": "Process Injection", "tactic": "defense_evasion"},
    "T1070.004": {"name": "File Deletion", "tactic": "defense_evasion"},
    "T1003": {"name": "OS Credential Dumping", "tactic": "credential_access"},
    "T1082": {"name": "System Information Discovery", "tactic": "discovery"},
    "T1083": {"name": "File and Directory Discovery", "tactic": "discovery"},
    "T1021.002": {"name": "SMB/Windows Admin Shares", "tactic": "lateral_movement"},
    "T1105": {"name": "Ingress Tool Transfer", "tactic": "lateral_movement"},
    "T1560": {"name": "Archive Collected Data", "tactic": "collection"},
    "T1048": {"name": "Exfiltration Over Alternative Protocol", "tactic": "exfiltration"},
    "T1486": {"name": "Data Encrypted for Impact", "tactic": "impact"},
    "T1490": {"name": "Inhibit System Recovery", "tactic": "impact"},
    "T1027": {"name": "Obfuscated Files or Information", "tactic": "defense_evasion"},
    "T1497": {"name": "Virtualization/Sandbox Evasion", "tactic": "defense_evasion"},
    "T1057": {"name": "Process Discovery", "tactic": "discovery"},
    "T1012": {"name": "Query Registry", "tactic": "discovery"},
    "T1071.001": {"name": "Web Protocols", "tactic": "command_and_control"},
}

# Detection signatures for events
EVENT_SIGNATURES: Dict[str, List[str]] = {
    "T1059.001": ["powershell", "-enc", "invoke-expression", "iex", "downloadstring"],
    "T1059.003": ["cmd.exe", "/c", "cmd /c"],
    "T1547.001": ["currentversion\\run", "hklm\\software", "reg add"],
    "T1053.005": ["schtasks", "at.exe", "scheduled"],
    "T1055": ["virtualallocex", "writeprocessmemory", "createremotethread", "ntmapviewofsection"],
    "T1070.004": ["del /f", "remove-item", "file_delete", "shred"],
    "T1003": ["lsass", "mimikatz", "procdump", "sekurlsa", "credential"],
    "T1082": ["systeminfo", "hostname", "os version"],
    "T1083": ["dir /s", "get-childitem", "find /", "tree"],
    "T1021.002": ["\\\\admin$", "\\\\c$", "net use", "psexec"],
    "T1105": ["certutil -urlcache", "bitsadmin", "wget", "curl -o"],
    "T1560": ["compress-archive", "7z", "rar a", "tar czf"],
    "T1048": ["ftp", "sftp", "scp", "dns tunnel"],
    "T1486": ["encrypt", "ransom", ".locked", "aes", "rsa"],
    "T1490": ["vssadmin delete", "wbadmin delete", "bcdedit /set"],
    "T1027": ["base64", "xor", "certutil -decode", "frombase64string"],
    "T1497": ["vboxguestadditions", "vmware", "virtualbox", "sandboxie", "wine_get"],
    "T1057": ["tasklist", "get-process", "ps aux"],
    "T1012": ["reg query", "get-itemproperty"],
    "T1071.001": ["http://", "https://", "user-agent"],
}

# Phase progression for predicted next step
PHASE_ORDER = [
    AttackPhase.INITIAL_ACCESS,
    AttackPhase.EXECUTION,
    AttackPhase.PERSISTENCE,
    AttackPhase.PRIVILEGE_ESCALATION,
    AttackPhase.DEFENSE_EVASION,
    AttackPhase.CREDENTIAL_ACCESS,
    AttackPhase.DISCOVERY,
    AttackPhase.LATERAL_MOVEMENT,
    AttackPhase.COLLECTION,
    AttackPhase.EXFILTRATION,
    AttackPhase.IMPACT,
]

ANTI_FORENSICS_INDICATORS = [
    "vboxguestadditions", "vmwaretray", "sandboxie", "wireshark",
    "procmon", "filemon", "regmon", "ollydbg", "x64dbg",
    "timestomp", "clearev", "wevtutil cl", "del /f /q %systemroot%\\logs",
    "ppid_spoof", "parent_pid_mismatch",
]


@dataclass
class MitreHit:
    technique_id: str
    technique_name: str
    tactic: str
    confidence: float
    evidence_snippets: List[str] = field(default_factory=list)


@dataclass
class AttackChainLink:
    phase: AttackPhase
    techniques: List[MitreHit]
    timestamp_range: Tuple[str, str]
    event_count: int


@dataclass
class ForensicPipelineResult:
    threat_classification: str
    severity_score: float
    mitre_mapping: List[MitreHit]
    attack_chain: List[AttackChainLink]
    anti_forensics_detected: bool
    anti_forensics_indicators: List[str]
    reconstruction_summary: str
    predicted_next_step: str
    stealth_rating: str  # "low", "medium", "high", "critical"


class ForensicPipeline:
    """Multi-stage forensic analysis pipeline."""

    def __init__(self, window_size: int = 10):
        self.window_size = window_size

    def analyze(self, events: List[Dict]) -> ForensicPipelineResult:
        """Run the full multi-stage pipeline."""
        # Stage 1: MITRE technique matching
        mitre_hits = self._map_mitre_techniques(events)

        # Stage 2: Sliding window attack chain detection
        attack_chain = self._detect_attack_chain(events, mitre_hits)

        # Stage 3: Anti-forensics detection
        anti_forensics = self._detect_anti_forensics(events)

        # Stage 4: Classification and scoring
        classification = self._classify_threat(mitre_hits, attack_chain)
        severity = self._calculate_severity(mitre_hits, attack_chain, anti_forensics)

        # Stage 5: Narrative reconstruction
        summary = self._reconstruct_narrative(attack_chain, mitre_hits)

        # Stage 6: Predict next step
        predicted = self._predict_next_step(attack_chain)

        # Stage 7: Stealth rating
        stealth = self._rate_stealth(anti_forensics, mitre_hits)

        return ForensicPipelineResult(
            threat_classification=classification,
            severity_score=severity,
            mitre_mapping=mitre_hits,
            attack_chain=attack_chain,
            anti_forensics_detected=len(anti_forensics) > 0,
            anti_forensics_indicators=anti_forensics,
            reconstruction_summary=summary,
            predicted_next_step=predicted,
            stealth_rating=stealth,
        )

    def _map_mitre_techniques(self, events: List[Dict]) -> List[MitreHit]:
        """Map events to MITRE ATT&CK techniques."""
        hits: Dict[str, MitreHit] = {}

        for event in events:
            event_str = self._event_to_searchable(event)
            for tech_id, signatures in EVENT_SIGNATURES.items():
                for sig in signatures:
                    if sig in event_str:
                        if tech_id not in hits:
                            info = MITRE_TECHNIQUES[tech_id]
                            hits[tech_id] = MitreHit(
                                technique_id=tech_id,
                                technique_name=info["name"],
                                tactic=info["tactic"],
                                confidence=0.0,
                                evidence_snippets=[],
                            )
                        hit = hits[tech_id]
                        hit.confidence = min(1.0, hit.confidence + 0.2)
                        snippet = event_str[:120]
                        if snippet not in hit.evidence_snippets and len(hit.evidence_snippets) < 3:
                            hit.evidence_snippets.append(snippet)
                        break

        return list(hits.values())

    def _detect_attack_chain(self, events: List[Dict], mitre_hits: List[MitreHit]) -> List[AttackChainLink]:
        """Sliding window attack chain detection."""
        if not events:
            return []

        # Group hits by tactic → phase
        tactic_to_phase: Dict[str, AttackPhase] = {
            "initial_access": AttackPhase.INITIAL_ACCESS,
            "execution": AttackPhase.EXECUTION,
            "persistence": AttackPhase.PERSISTENCE,
            "privilege_escalation": AttackPhase.PRIVILEGE_ESCALATION,
            "defense_evasion": AttackPhase.DEFENSE_EVASION,
            "credential_access": AttackPhase.CREDENTIAL_ACCESS,
            "discovery": AttackPhase.DISCOVERY,
            "lateral_movement": AttackPhase.LATERAL_MOVEMENT,
            "collection": AttackPhase.COLLECTION,
            "exfiltration": AttackPhase.EXFILTRATION,
            "impact": AttackPhase.IMPACT,
            "command_and_control": AttackPhase.LATERAL_MOVEMENT,
        }

        # Assign phases to each event window
        chain: List[AttackChainLink] = []
        window: deque = deque(maxlen=self.window_size)
        phase_techniques: Dict[AttackPhase, List[MitreHit]] = {}

        for event in events:
            window.append(event)
            if len(window) < self.window_size:
                continue

            # Check which techniques match this window
            window_str = " ".join(self._event_to_searchable(e) for e in window)
            for hit in mitre_hits:
                for snippet in hit.evidence_snippets:
                    if snippet[:40] in window_str:
                        phase = tactic_to_phase.get(hit.tactic, AttackPhase.EXECUTION)
                        if phase not in phase_techniques:
                            phase_techniques[phase] = []
                        if hit not in phase_techniques[phase]:
                            phase_techniques[phase].append(hit)
                        break

        # Build chain from detected phases in kill-chain order
        for phase in PHASE_ORDER:
            if phase in phase_techniques:
                techs = phase_techniques[phase]
                ts_start = events[0].get("timestamp", "")
                ts_end = events[-1].get("timestamp", "")
                chain.append(AttackChainLink(
                    phase=phase,
                    techniques=techs,
                    timestamp_range=(ts_start, ts_end),
                    event_count=len(events),
                ))

        return chain

    def _detect_anti_forensics(self, events: List[Dict]) -> List[str]:
        """Detect anti-forensics indicators."""
        detected: List[str] = []
        all_text = " ".join(self._event_to_searchable(e) for e in events)

        for indicator in ANTI_FORENSICS_INDICATORS:
            if indicator in all_text:
                detected.append(indicator)

        # Check for parent PID spoofing patterns
        pids_seen: Dict[str, str] = {}
        for event in events:
            details = event.get("details", {})
            pid = str(details.get("pid", ""))
            ppid = str(details.get("ppid", details.get("parent_pid", "")))
            proc_name = details.get("process_name", event.get("source", ""))

            if pid and ppid and proc_name:
                if proc_name in pids_seen and pids_seen[proc_name] != ppid:
                    if "ppid_spoof" not in detected:
                        detected.append("ppid_spoof")
                pids_seen[proc_name] = ppid

        return detected

    def _classify_threat(self, mitre_hits: List[MitreHit], chain: List[AttackChainLink]) -> str:
        """Classify the overall threat type."""
        tactics = {h.tactic for h in mitre_hits}

        if "impact" in tactics and any("T1486" == h.technique_id for h in mitre_hits):
            return "ransomware"
        if "exfiltration" in tactics:
            return "data_theft"
        if "credential_access" in tactics and "lateral_movement" in tactics:
            return "apt_intrusion"
        if "credential_access" in tactics:
            return "credential_harvesting"
        if "persistence" in tactics and len(chain) >= 3:
            return "persistent_threat"
        if len(mitre_hits) > 5:
            return "multi_stage_attack"
        if mitre_hits:
            return "suspicious_activity"
        return "benign"

    def _calculate_severity(self, hits: List[MitreHit], chain: List[AttackChainLink], anti_forensics: List[str]) -> float:
        """Calculate severity score 0-100."""
        score = 0.0
        score += min(40.0, len(hits) * 8.0)
        score += min(30.0, len(chain) * 10.0)
        score += min(20.0, len(anti_forensics) * 10.0)
        avg_confidence = sum(h.confidence for h in hits) / max(1, len(hits))
        score += avg_confidence * 10.0
        return min(100.0, score)

    def _reconstruct_narrative(self, chain: List[AttackChainLink], hits: List[MitreHit]) -> str:
        """Generate human-readable attack narrative."""
        if not chain:
            return "No significant attack chain detected. Activity appears benign or insufficient data for reconstruction."

        parts = []
        for i, link in enumerate(chain):
            tech_names = ", ".join(t.technique_name for t in link.techniques[:3])
            if i == 0:
                parts.append(f"The attack initiated with {link.phase.value.replace('_', ' ')} using {tech_names}.")
            else:
                parts.append(f"This progressed to {link.phase.value.replace('_', ' ')} ({tech_names}).")

        if len(chain) >= 3:
            parts.append(f"The kill chain spans {len(chain)} distinct phases, indicating a sophisticated multi-stage operation.")

        return " ".join(parts)

    def _predict_next_step(self, chain: List[AttackChainLink]) -> str:
        """Predict the attacker's likely next action based on kill chain position."""
        if not chain:
            return "Insufficient data for prediction. Monitor for initial access indicators."

        last_phase = chain[-1].phase
        try:
            idx = PHASE_ORDER.index(last_phase)
            if idx + 1 < len(PHASE_ORDER):
                next_phase = PHASE_ORDER[idx + 1]
                predictions = {
                    AttackPhase.EXECUTION: "Expect process execution via scripting engines (PowerShell, cmd).",
                    AttackPhase.PERSISTENCE: "Attacker likely establishing persistence via registry keys or scheduled tasks.",
                    AttackPhase.PRIVILEGE_ESCALATION: "Privilege escalation attempt expected — monitor UAC bypass and token manipulation.",
                    AttackPhase.DEFENSE_EVASION: "Defense evasion imminent — watch for log clearing, timestomping, or process masquerading.",
                    AttackPhase.CREDENTIAL_ACCESS: "Credential harvesting expected — monitor LSASS access and registry SAM dumps.",
                    AttackPhase.DISCOVERY: "Environment enumeration likely — watch for systeminfo, net commands, directory listing.",
                    AttackPhase.LATERAL_MOVEMENT: "Lateral movement expected — monitor SMB, WinRM, PsExec usage.",
                    AttackPhase.COLLECTION: "Data staging predicted — watch for archive creation and sensitive file access.",
                    AttackPhase.EXFILTRATION: "Data exfiltration imminent — monitor outbound traffic on unusual ports.",
                    AttackPhase.IMPACT: "Destructive action likely — ransomware deployment or data destruction expected.",
                }
                return predictions.get(next_phase, f"Next expected phase: {next_phase.value}")
        except ValueError:
            pass

        return "Attack chain complete. Post-incident containment and forensic preservation recommended."

    def _rate_stealth(self, anti_forensics: List[str], hits: List[MitreHit]) -> str:
        """Rate the stealth level of the detected activity."""
        score = len(anti_forensics) * 2
        evasion_hits = [h for h in hits if h.tactic == "defense_evasion"]
        score += len(evasion_hits) * 1.5
        if score >= 8:
            return "critical"
        if score >= 5:
            return "high"
        if score >= 2:
            return "medium"
        return "low"

    def _event_to_searchable(self, event: Dict) -> str:
        """Flatten event to searchable lowercase string."""
        parts = [
            event.get("type", ""),
            event.get("source", ""),
            str(event.get("details", {})),
        ]
        return " ".join(parts).lower()


# Singleton instance
forensic_pipeline = ForensicPipeline()
