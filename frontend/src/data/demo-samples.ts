/**
 * Demo sample library — curated sample documents and URLs that exercise the
 * analysis engines. All samples are synthetic and benign; they are crafted
 * only to trip the backend heuristic analyzers (VBA markers, DDE, base64
 * blobs, suspicious TLDs, phishing query params, homoglyph domains, etc.).
 */

export interface DocumentSample {
  id: string;
  file: string;
  name: string;
  description: string;
}

export interface UrlSample {
  id: string;
  url: string;
  name: string;
  description: string;
}

export const DOCUMENT_SAMPLES: DocumentSample[] = [
  {
    id: 'lockbyte-invoice',
    file: 'lockbyte-invoice.docx',
    name: 'LockByte Ransomware — Payment Invoice',
    description: 'Invoice with embedded VBA, DDE field code and PowerShell execution markers.',
  },
  {
    id: 'hivemind-c2-config',
    file: 'hivemind-c2-config.docx',
    name: 'HiveMind Botnet — C2 Config',
    description: 'Botnet command-and-control configuration with encoded payload blob.',
  },
  {
    id: 'vaultdrain-login-dump',
    file: 'vaultdrain-login-dump.docx',
    name: 'VaultDrain — Credential Dump',
    description: 'Credential-stealer harvesting script with exfil endpoint.',
  },
  {
    id: 'silenteye-keylogger',
    file: 'silenteye-keylogger.docx',
    name: 'SilentEye — Keylogger Telemetry',
    description: 'Spyware keylogger with clipboard capture and telemetry upload.',
  },
  {
    id: 'ghostkernel-driver',
    file: 'ghostkernel-driver.docx',
    name: 'GhostKernel — Rootkit Driver',
    description: 'Rootkit driver load script with registry persistence.',
  },
  {
    id: 'netwarp-scanner',
    file: 'netwarp-scanner-script.docx',
    name: 'NetWarp — Lateral Movement Script',
    description: 'Network scanner / lateral movement script targeting multiple subnets.',
  },
  {
    id: 'wraith-installer',
    file: 'wraith-installer.docx',
    name: 'Wraith — Trojan Installer',
    description: 'Trojan dropper installer with download-and-execute chain.',
  },
  {
    id: 'macro-dropper',
    file: 'macro-dropper.docx',
    name: 'Macro Dropper — Document_Open',
    description: 'Office macro dropper that drops a payload to the startup folder.',
  },
  {
    id: 'executive-invoice-pdf',
    file: 'executive-invoice.pdf',
    name: 'Phishing Lure — Fake Executive Invoice (PDF)',
    description: 'Phishing PDF with JavaScript actions, launch actions and account-verify lure.',
  },
  {
    id: 'exfil-report-pdf',
    file: 'exfil-report.pdf',
    name: 'Data Exfiltration — Upload Report (PDF)',
    description: 'PDF describing a data-exfiltration upload pipeline with embedded script blocks.',
  },
];

export const URL_SAMPLES: UrlSample[] = [
  {
    id: 'lockbyte-payment',
    url: 'http://192.168.14.7/payment-portal/pay.php?token=a1b2c3&redirect=https://lockbyte.example.net',
    name: 'LockByte Ransomware — Payment Portal',
    description: 'IP-based payment portal with token and redirect parameters.',
  },
  {
    id: 'hivemind-c2',
    url: 'http://c2-panel.tk/botnet/admin/login.php?auth=1&key=9f8e7d6c5b4a',
    name: 'HiveMind Botnet — C2 Panel Login',
    description: 'Suspicious .tk C2 panel with auth bypass query parameters.',
  },
  {
    id: 'vaultdrain-webscr',
    url: 'https://secure-login.top/webscr?cmd=_login&token=f1e2d3c4b5a6&return=https://evil.example.com',
    name: 'VaultDrain — Fake Login Collector',
    description: 'Lookalike payment login page on suspicious .top TLD.',
  },
  {
    id: 'silenteye-telemetry',
    url: 'http://spy-panel.xyz/telemetry?apikey=77aabbcc&callback=http://silenteye.example.net',
    name: 'SilentEye — Telemetry Exfil',
    description: 'Spyware telemetry endpoint with API key and callback parameters.',
  },
  {
    id: 'ghostkernel-update',
    url: 'https://driver-download.site/kernel/update.php?ref=9a8b7c6d&ver=2.1.4',
    name: 'GhostKernel — Driver Update Channel',
    description: 'Rootkit driver update endpoint on suspicious .site TLD.',
  },
  {
    id: 'netwarp-exploit',
    url: 'http://scan-host.ml/network/exploit?ip=10.0.0.0/24&port=445',
    name: 'NetWarp — Network Exploit Target',
    description: 'Scanner host invoking exploit against a subnet with SMB port.',
  },
  {
    id: 'wraith-installer',
    url: 'https://wraith-update.online/download/installer.php?next=1&code=77e88f99',
    name: 'Wraith — Payload Download',
    description: 'Trojan payload download with next/code tracking parameters.',
  },
  {
    id: 'paypa1-verify',
    url: 'https://paypa1-secure.xyz/verify/account?redirect=https://paypal.com.attacker.net',
    name: 'Paypa1 — Homoglyph Phishing',
    description: 'Homoglyph payment brand ("paypa1") with redirect to attacker-controlled host.',
  },
  {
    id: 'exfil-bucket',
    url: 'http://exfil-bucket.ga/upload?key=deadbeef&url=http://target.corp.example:8080',
    name: 'Exfil Bucket — Data Upload',
    description: 'Exfiltration upload endpoint with key and internal target URL.',
  },
  {
    id: 'macro-host-download',
    url: 'http://macro-host.cf/documents/invoice.docx?password=a4b5c6',
    name: 'Macro Host — Password-Protected Download',
    description: 'Suspicious .cf host serving a password-protected document.',
  },
];