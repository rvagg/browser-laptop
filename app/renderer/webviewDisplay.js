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
    return webview
  }
}
