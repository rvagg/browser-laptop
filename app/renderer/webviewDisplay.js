let i = 0

module.exports = class WebviewDisplay {
  constructor ({ containerElement, classNameWebview, classNameWebviewAttached, onFocus }) {
    if (!containerElement) {
      throw new Error('Must pass a valid containerElement to WebviewDisplay constructor')
    }
    this.containerElement = containerElement
    this.classNameWebview = classNameWebview
    this.classNameWebviewAttached = classNameWebviewAttached
    this.onFocus = onFocus
    this.webviewPool = []
    // when contents are destroyed, don't remove the webview immediately,
    // wait for a potential new view to be displayed before removing.
    // Ensures a smooth transition with no 'white flash'
    this.webviewsPendingRemoval = []
    this.attachedWebview = null
    this.ensureWebviewPoolSize()
  }

  ensureWebviewPoolSize () {
    // There should be 1 in the pool and 1 attached,
    // or 2 in the pool.
    let requiredPoolSize = this.attachedWebview ? 1 : 2
    const poolDeficit = requiredPoolSize - this.webviewPool.length
    for (let i = 0; i < poolDeficit; i++) {
      this.addPooledWebview()
    }
  }

  addPooledWebview () {
    const newWebview = this.createPooledWebview()
    newWebview.dataset.webviewReplaceCount = i++
    this.webviewPool.push(newWebview)
    this.containerElement.appendChild(newWebview)
  }

  createPooledWebview () {
    console.log('creating a webview')
    const webview = document.createElement('webview')
    webview.classList.add(this.classNameWebview)
    // webview is not usable if a WebContents is destroyed whilst attached.
    // We try to avoid this happening, but it's inveitable, so replace the webview
    // when that happens.
    const onContentsDestroyed = () => {
      console.log('contents destroyed, removing webview')
      // no longer attached
      if (this.attachedWebview === webview) {
        this.attachedWebview = null
      }
      webview.detachGuest()
      // return to pool
      this.webviewPool.push(webview)
      this.ensureWebviewPoolSize()
      webview.removeEventListener('will-destroy', onContentsDestroyed)
    }
    webview.addEventListener('will-destroy', onContentsDestroyed)
    if (this.onFocus) {
      webview.addEventListener('focus', this.onFocus)
    }
    return webview
  }

  getPooledWebview () {
    this.ensureWebviewPoolSize()
    return this.webviewPool.pop()
  }

  attachActiveTab (guestInstanceId) {
    if (guestInstanceId == null) {
      throw new Error('guestInstanceId is not valid')
    }
    // do nothing if repeat call to same guest Id
    if (guestInstanceId === this.activeGuestInstanceId) {
      return
    }
    console.group(`attach ${guestInstanceId}`)
    this.activeGuestInstanceId = guestInstanceId
    const toAttachWebview = this.getPooledWebview()
    console.log(`Using webview #${toAttachWebview.dataset.webviewReplaceCount}`)
    // This webview will now be the currently attached webview.
    // We set it here, before it's ready, just in case we are made inactive before we detach,
    // we won't want to force showing once we do attach.
    const lastAttachedWebview = this.attachedWebview
    //this.webviewsPendingRemoval.push(lastAttachedWebview)
    this.attachedWebview = toAttachWebview
    // let's keep this around until the new one
    const t0 = window.performance.now()
    let timeoutHandleShowAttchedView = null

    const showAttachedView = () => {
      if (timeoutHandleShowAttchedView === null) {
        console.log(`not running show because already done ${window.performance.now() - t0}ms`)
        return
      }
      window.clearTimeout(timeoutHandleShowAttchedView)
      timeoutHandleShowAttchedView = null
      // check if we're still meant to be the primary view
      console.log(`webview showing ${window.performance.now() - t0}ms`)
      if (this.attachedWebview === toAttachWebview) {
        toAttachWebview.classList.add(this.classNameWebviewAttached)
      }
      console.groupEnd()
      // If we were showing another frame, we wait for this new frame to display before
      // hiding (and removing) the other frame's webview, so that we avoid a white flicker
      // between attach.
      if (lastAttachedWebview) {
        lastAttachedWebview.classList.remove(this.classNameWebviewAttached)
        lastAttachedWebview.detachGuest()
        // return to the pool,
        this.webviewPool.push(lastAttachedWebview)
        // but for now we remove from DOM to avoid blank attach bug
        console.log('removing last attached webview')
      }
      this.removePendingWebviews()
      window.requestAnimationFrame(this.ensureWebviewPoolSize.bind(this))
    }

    const onToAttachDidAttach = () => {
      toAttachWebview.removeEventListener('did-attach', onToAttachDidAttach)
      console.log(`webview did-attach ${window.performance.now() - t0}ms`)
      // TODO(petemill) remove ugly workaround as <webview> will not paint guest unless size has changed or forced to
      window.requestAnimationFrame(() => { // <- quicker than window.requestAnimationFrame and still works
        toAttachWebview.style.visibility = 'hidden'
        window.requestAnimationFrame(() => {
          toAttachWebview.style.visibility = ''
          window.requestAnimationFrame(showAttachedView)
        })
      })
    }

    toAttachWebview.addEventListener('did-attach', onToAttachDidAttach)
    console.log('attaching active guest instance ', guestInstanceId, 'to webview', toAttachWebview)
    toAttachWebview.attachGuest(guestInstanceId)
    // just show the webview after a timeout if attachment has not rendered in time
    console.log(`start timeout for attached view ${window.performance.now() - t0}ms`)
    timeoutHandleShowAttchedView = window.setTimeout(showAttachedView, 200)
  }

  detach () {
    console.log('detaching')
    this.activeGuestInstanceId = null
    if (this.attachedWebview) {
      this.attachedWebview.detachGuest()
      console.log('detach called, removing attached webview')
      this.attachedWebview.remove()
      this.attachedWebview = null
    }
  }

  removePendingWebviews () {
    if (this.webviewsPendingRemoval.length) {
      const webviewsToRemove = this.webviewsPendingRemoval
      this.webviewsPendingRemoval = []
      for (const webview of webviewsToRemove) {
        if (!webview) {
          continue
        }
        // just in case... (don't want to remove a webview with contents still attached
        // since the contents will be destroyed)
        webview.detachGuest()
        // remove from DOM and allow garbage collection / event removal
        webview.remove()
      }
    }
  }
}
