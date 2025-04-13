const emailInput = document.getElementById('email');
const scanBtn = document.getElementById('scanBtn');
const submitBtn = document.getElementById('submitBtn');
const fingerprintHashInput = document.getElementById('fingerprintHash');
const statusText = document.getElementById('statusText');

const showStatus = (message, isError = false) => {
  statusText.textContent = message;
  statusText.className = 'status ' + (isError ? 'error' : 'success');
};

// Load email from URL
const params = new URLSearchParams(window.location.search);
const email = decodeURIComponent(params.get('email') || '');

console.log("🔍 Loaded email from URL:", email);
emailInput.value = email;

if (!email) {
  showStatus("⚠ No email provided in URL. Please access the page with ?email=you@example.com", true);
} else {
  scanBtn.disabled = false;
  scanBtn.focus();
  showStatus("Ready to scan your fingerprint.");
}

const getFingerprint = async () => {
  if (!email) {
    alert("⚠ Email is missing. Cannot scan.");
    return;
  }

  showStatus("📡 Scanning fingerprint...");

  if (!navigator.credentials || !navigator.credentials.create) {
    showStatus("❌ Fingerprint scanning is not supported on this device.", true);
    alert("⚠ Your browser does not support WebAuthn fingerprint scanning.");
    return;
  }

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: new Uint8Array(32),
        rp: { name: "Employee Attendance System" },
        user: {
          id: new Uint8Array(16),
          name: email,
          displayName: email
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        attestation: "none"
      }
    });

    console.log("✅ Credential created:", credential);

    const clientDataJSON = Array.from(new Uint8Array(credential.response.clientDataJSON));
    const attestationObject = Array.from(new Uint8Array(credential.response.attestationObject));

    const fingerprintData = {
      clientDataJSON,
      attestationObject
    };

    const fingerprintHash = btoa(JSON.stringify(fingerprintData));
    fingerprintHashInput.value = fingerprintHash;
    submitBtn.disabled = false;

    showStatus("✅ Fingerprint scanned successfully!");
  } catch (error) {
    console.error("Fingerprint Error:", error);
    showStatus("❌ Fingerprint scan failed or cancelled.", true);
    alert("❌ Fingerprint scan failed. Please try again.");
  }
};

scanBtn.addEventListener('click', getFingerprint);

document.getElementById('fingerprintForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const fingerprintHash = fingerprintHashInput.value.trim();

  if (!email || !fingerprintHash) {
    alert("⚠ Email and fingerprint data are required.");
    return;
  }

  try {
    const response = await fetch('/register-fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fingerprintHash })
    });

    const result = await response.json();
    if (response.ok) {
      showStatus(result.message || '✅ Fingerprint registered!');
      alert('🎉 Fingerprint registration successful!');
    } else {
      showStatus(result.message || '❌ Registration failed.', true);
      alert(`❌ ${result.message}`);
    }
  } catch (error) {
    console.error("Submission Error:", error);
    showStatus("❌ Error submitting fingerprint.", true);
    alert('❌ Something went wrong while submitting.');
  }
});