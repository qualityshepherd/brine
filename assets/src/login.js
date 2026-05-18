import { initEditor } from './editor.js'

export function initLoginModal () {
  const overlay = document.createElement('div')
  overlay.id = 'login-modal'
  overlay.className = 'login-modal-overlay hidden'
  overlay.innerHTML = `
    <div class="login-modal">
      <div class="login-modal-header">
        <span>sign in</span>
        <button class="login-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="login-modal-body">
        <div id="lm-unconfigured" class="hidden">
          <p class="login-modal-hint">no owner configured — enter a passphrase to derive your pubkey, then add it to <code>wrangler.toml</code> as <code>OWNER</code> and redeploy.</p>
          <div class="login-modal-field">
            <label for="lm-setup-passphrase">passphrase</label>
            <div class="login-modal-input-wrap">
              <input type="password" id="lm-setup-passphrase" placeholder="enter your passphrase" autocomplete="new-password">
              <button type="button" class="login-modal-eye" data-target="lm-setup-passphrase"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            </div>
            <div class="login-modal-strength hidden" id="lm-strength"></div>
          </div>
          <button class="btn btn-primary" id="lm-btn-derive">derive pubkey</button>
          <div id="lm-pubkey-result" class="hidden login-modal-field" style="margin-top:var(--space-4)">
            <label for="lm-pubkey">your pubkey — copy into wrangler.toml as OWNER</label>
            <input type="text" id="lm-pubkey" readonly onclick="this.select()">
          </div>
        </div>
        <div id="lm-existing" class="hidden">
          <div class="login-modal-field">
            <label for="lm-passphrase">passphrase</label>
            <div class="login-modal-input-wrap">
              <input type="password" id="lm-passphrase" placeholder="your passphrase" autocomplete="current-password">
              <button type="button" class="login-modal-eye" data-target="lm-passphrase"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            </div>
          </div>
          <button class="btn btn-primary" id="lm-btn-login">sign in</button>
        </div>
        <div class="login-modal-error hidden" id="lm-error"></div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const close = () => { overlay.classList.add('hidden'); document.body.style.overflow = '' }
  const showErr = msg => { const el = overlay.querySelector('#lm-error'); el.textContent = msg; el.classList.remove('hidden') }
  const hideErr = () => overlay.querySelector('#lm-error').classList.add('hidden')

  overlay.querySelector('.login-modal-close').addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close() })

  overlay.querySelectorAll('.login-modal-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = overlay.querySelector(`#${btn.dataset.target}`)
      input.type = input.type === 'password' ? 'text' : 'password'
    })
  })

  document.getElementById('btn-sign-in')?.addEventListener('click', async () => {
    document.getElementById('kebab-dropdown').hidden = true
    hideErr()
    overlay.querySelector('#lm-unconfigured').classList.add('hidden')
    overlay.querySelector('#lm-existing').classList.add('hidden')
    overlay.classList.remove('hidden')
    document.body.style.overflow = 'hidden'

    const res = await fetch('/api/challenge').then(r => r.json()).catch(() => ({}))
    if (res.configured === false) {
      overlay.querySelector('#lm-unconfigured').classList.remove('hidden')
    } else {
      overlay.querySelector('#lm-existing').classList.remove('hidden')
      overlay.querySelector('#lm-passphrase').focus()
    }
  })

  overlay.querySelector('#lm-setup-passphrase').addEventListener('input', async () => {
    const val = overlay.querySelector('#lm-setup-passphrase').value
    const el = overlay.querySelector('#lm-strength')
    if (!val) { el.classList.add('hidden'); return }
    const { scorePassphrase } = await import('../../../../../../lib/keys.js')
    const { score, flavor } = scorePassphrase(val)
    el.className = `login-modal-strength strength-${score}`
    el.textContent = flavor
    el.classList.remove('hidden')
  })

  overlay.querySelector('#lm-btn-derive').addEventListener('click', async () => {
    const passphrase = overlay.querySelector('#lm-setup-passphrase').value.trim()
    if (!passphrase) return
    const { deriveKeypair, scorePassphrase } = await import('../../../../../../lib/keys.js')
    const { score } = scorePassphrase(passphrase)
    if (score < 3) { showErr('passphrase too weak — aim for a long phrase'); return }
    hideErr()
    const { pubkey } = await deriveKeypair(passphrase, location.hostname)
    overlay.querySelector('#lm-pubkey').value = pubkey
    overlay.querySelector('#lm-pubkey-result').classList.remove('hidden')
  })

  const doLogin = async () => {
    const passphrase = overlay.querySelector('#lm-passphrase').value.trim()
    if (!passphrase) return
    hideErr()
    try {
      const { deriveKeypair, signChallenge } = await import('../../../../../../lib/keys.js')
      const { privateKey, pubkey } = await deriveKeypair(passphrase, location.hostname)
      const { challenge } = await fetch('/api/challenge').then(r => r.json())
      const sig = await signChallenge(challenge, privateKey)
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, challenge, sig })
      }).then(r => r.json())
      if (res.error) throw new Error(res.error)
      close()
      initEditor()
    } catch (e) {
      showErr(e.message)
    }
  }

  overlay.querySelector('#lm-btn-login').addEventListener('click', doLogin)
  overlay.querySelector('#lm-passphrase').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
}
