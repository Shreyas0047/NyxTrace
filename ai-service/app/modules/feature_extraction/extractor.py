"""
Forensic Feature Extraction Module

Extracts structured features from raw telemetry data for AI analysis.
"""

import logging
import re
from typing import List, Dict, Any

from app.core.models import (
    TelemetryEvent,
    ForensicFeatureSet
)


logger = logging.getLogger(__name__)


class ForensicFeatureExtractor:
    """Extracts forensic features from telemetry events"""

    # Suspicious file extensions
    SUSPICIOUS_EXTENSIONS = [
        '.exe', '.dll', '.sys', '.bat', '.cmd', '.ps1',
        '.vbs', '.js', '.jse', '.wsf', '.wsh', '.hta',
        '.scr', '.pif', '.com', '.jar', '.sh', '.bin'
    ]

    # Suspicious registry keys for persistence
    PERSISTENCE_KEY_PATTERNS = [
        r'Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        r'Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
        r'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved',
        r'System\\CurrentControlSet\\Services',
    ]

    # Credential-related registry key patterns
    CREDENTIAL_KEY_PATTERNS = [
        r'SAM',
        r'SECURITY',
        r'CredentialManager',
        r'CurrentVersion\\Authentication',
        r'LSA',
        r'Windows NT\\CurrentVersion\\ProfileList',
        r'Microsoft\\Windows NT\\CurrentVersion\\ProfileGuid',
    ]

    # Suspicious command patterns
    SUSPICIOUS_COMMANDS = [
        r'powershell.*-enc',
        r'powershell.*-encodedcommand',
        r'cmd.*\/c',
        r'certutil.*-decode',
        r'regsvr32.*\/s',
        r'rundll32.*\.dll',
        r'msiexec.*http',
    ]

    SUSPICIOUS_COMMAND_PATTERNS = [
        re.compile(pattern, re.IGNORECASE) for pattern in SUSPICIOUS_COMMANDS
    ]

    # Suspicious network patterns
    SUSPICIOUS_PORTS = [4444, 5555, 6666, 7777, 8888, 31337, 1337]
    SUSPICIOUS_IP_PATTERNS = [r'\.tk$', r'\.ml$', r'\.xyz$', r'\.top$']

    def extract_features(self, events: List[TelemetryEvent]) -> ForensicFeatureSet:
        """Extract forensic features from events"""
        features = ForensicFeatureSet()

        for event in events:
            event_type = event.type.lower()
            details = event.details

            if event_type == 'process':
                self._extract_process_features(features, details)
                self._extract_credential_access_features(features, details)
            elif event_type == 'file':
                self._extract_file_features(features, details)
                self._extract_credential_access_features(features, details)
            elif event_type == 'registry':
                self._extract_registry_features(features, details)
                self._extract_credential_access_features(features, details)
            elif event_type == 'network':
                self._extract_network_features(features, details)
            else:
                logger.warning(f"Unrecognized event type: {event_type}")
                if 'file' in event_type or 'encrypt' in event_type or 'write' in event_type or 'delete' in event_type:
                    self._extract_file_features(features, details)
                    self._extract_credential_access_features(features, details)
                elif 'process' in event_type or 'start' in event_type or 'terminate' in event_type:
                    self._extract_process_features(features, details)
                    self._extract_credential_access_features(features, details)
                elif 'registry' in event_type:
                    self._extract_registry_features(features, details)
                    self._extract_credential_access_features(features, details)
                elif 'network' in event_type or 'connect' in event_type or 'dns' in event_type or 'beacon' in event_type:
                    self._extract_network_features(features, details)

        return features

    def _extract_process_features(self, features: ForensicFeatureSet, details: Dict[str, Any]):
        """Extract process-related features"""
        features.total_processes += 1

        # Check for suspicious commands
        command = details.get('commandLine', '') or details.get('command', '')
        if command:
            for pattern in self.SUSPICIOUS_COMMAND_PATTERNS:
                if pattern.search(command):
                    features.suspicious_commands.append(command[:100])
                    features.suspicious_processes += 1
                    break

        # Check for suspicious parent processes
        parent = details.get('parentProcess', '')
        suspicious_parents = ['cmd.exe', 'powershell.exe', 'wscript.exe', 'cscript.exe']
        if parent and any(sp.lower() in parent.lower() for sp in suspicious_parents):
            features.suspicious_processes += 1

        # Check for process injection indicators
        if details.get('injected'):
            features.suspicious_processes += 1

    def _extract_file_features(self, features: ForensicFeatureSet, details: Dict[str, Any]):
        """Extract file operation features"""
        operation = details.get('operation', '').lower()
        path = details.get('path', '')

        features.file_operations += 1

        if 'create' in operation:
            features.file_creates += 1
        elif 'modify' in operation or 'write' in operation:
            features.file_modifications += 1
        elif 'delete' in operation or 'remove' in operation:
            features.file_deletes += 1

        # Check for suspicious extensions
        if path:
            ext = '.' + path.split('.')[-1].lower() if '.' in path else ''
            if ext in self.SUSPICIOUS_EXTENSIONS:
                features.suspicious_extensions.append(ext)

        # Check for encryption indicators
        if any(kw in operation.lower() for kw in ['encrypt', 'cipher', 'crypt']):
            features.encryption_indicators += 1

    def _extract_registry_features(self, features: ForensicFeatureSet, details: Dict[str, Any]):
        """Extract registry operation features"""
        operation = details.get('operation', '').lower()
        key = details.get('key', '') or details.get('path', '')

        features.registry_operations += 1

        if 'write' in operation or 'set' in operation:
            features.registry_writes += 1

        # Check for persistence keys
        if key:
            for pattern in self.PERSISTENCE_KEY_PATTERNS:
                if pattern.lower() in key.lower():
                    features.persistence_keys.append(key[:100])
                    break

        # Check for credential-related registry keys
        if key:
            for pattern in self.CREDENTIAL_KEY_PATTERNS:
                if pattern.lower() in key.lower():
                    features.credential_access_indicators += 1
                    break

    def _extract_credential_access_features(self, features: ForensicFeatureSet, details: Dict[str, Any]):
        """Extract credential access indicators from events"""
        command = details.get('commandLine', '') or details.get('command', '')
        path = details.get('path', '') or details.get('targetPath', '')
        key = details.get('key', '') or details.get('path', '')

        if 'lsass.exe' in command.lower() or 'vaultcli.exe' in command.lower():
            features.credential_access_indicators += 1

        credential_paths = [
            r'system32\config\SAM',
            r'system32\config\SECURITY',
            r'system32\config\RegBack\SAM',
            r'system32\config\RegBack\SECURITY',
            r'System32\LSA',
        ]
        for cp in credential_paths:
            if cp.lower() in path.lower():
                features.credential_access_indicators += 1
                break

        if key:
            for pattern in self.CREDENTIAL_KEY_PATTERNS:
                if pattern.lower() in key.lower():
                    features.credential_access_indicators += 1
                    break

    def _extract_network_features(self, features: ForensicFeatureSet, details: Dict[str, Any]):
        """Extract network connection features"""
        features.network_connections += 1

        dest_ip = details.get('destination', '') or details.get('remoteAddress', '')
        dest_port = details.get('port', 0) or details.get('remotePort', 0)

        # Track external IPs
        if dest_ip and not dest_ip.startswith(('10.', '192.168.', '172.', '127.')):
            if dest_ip not in features.external_ips:
                features.external_ips.append(dest_ip)

        # Check for suspicious ports
        if dest_port in self.SUSPICIOUS_PORTS:
            features.suspicious_ports.append(dest_port)

        # Check for download indicators
        if details.get('url') or details.get('download'):
            features.download_indicators += 1

    def get_feature_summary(self, features: ForensicFeatureSet) -> Dict[str, Any]:
        """Get a summary of extracted features"""
        return {
            "processes": {
                "total": features.total_processes,
                "suspicious": features.suspicious_processes,
                "suspicion_ratio": features.suspicious_processes / max(features.total_processes, 1)
            },
            "files": {
                "total_operations": features.file_operations,
                "creates": features.file_creates,
                "modifications": features.file_modifications,
                "deletes": features.file_deletes,
                "suspicious_types": len(features.suspicious_extensions)
            },
            "registry": {
                "total_operations": features.registry_operations,
                "writes": features.registry_writes,
                "persistence_keys": len(features.persistence_keys)
            },
            "network": {
                "connections": features.network_connections,
                "external_ips": len(features.external_ips),
                "suspicious_ports": len(features.suspicious_ports)
            },
            "indicators": {
                "encryption": features.encryption_indicators,
                "credential_access": features.credential_access_indicators,
                "downloads": features.download_indicators
            }
        }


feature_extractor = ForensicFeatureExtractor()
