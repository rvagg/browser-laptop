module.exports = class SingleWebviewDisplay {
  constructor ({containerElement, classNameWebview}) {
    this.isAttached = false
    this.webview = this.createWebview()
    this.webview.classList.add(classNameWebview)
    containerElement.appendChild(this.webview)
  }

  attachActiveTab (guestInstanceId) {
    console.log('webviewDisplay: attaching guest id', guestInstanceId)
    this.webview.attachGuest(guestInstanceId)
    this.isAttached = true
    // workaround for blank view when attaching a new guest
    window.requestAnimationFrame(() => {
      this.webview.style.visibility = 'hidden'
      window.requestAnimationFrame(() => {
        this.webview.style.visibility = ''
      })
    })
  }

  createWebview () {
    console.log('creating a webview')
    const webview = document.createElement('webview')
    // webview is not usable if a WebContents is destroyed whilst attached.
    // We try to avoid this happening, but it's inveitable, so replace the webview
    // when that happens.
    const onContentsDestroyed = () => {
      // no longer attached
      this.isAttached = false
      // don't want to destroy contents when attached
      webview.detachGuest()
    }
    webview.addEventListener('will-destroy', onContentsDestroyed)
    return webview
  }
}
