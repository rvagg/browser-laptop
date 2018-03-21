let i = 0

function ensurePaintWebviewFirstAttach (webview, cb = () => {}) {
  window.requestAnimationFrame(() => {
    webview.style.display = 'none'
    window.requestAnimationFrame(() => {
      webview.style.display = ''
      window.requestAnimationFrame(cb)
    })
  })
}

function ensurePaintWebviewSubsequentAttach (webview, cb = () => {}) {
  window.requestAnimationFrame(() => {
    webview.style.top = '1px'
    window.requestAnimationFrame(() => {
      webview.style.top = ''
      window.requestAnimationFrame(cb)
    })
  })
}

module.exports = class WebviewDisplay {
  constructor ({ containerElement, classNameWebview, classNameWebviewAttached, onFocus, shouldRemoveOnDestroy = false }) {
    if (!containerElement) {
      throw new Error('Must pass a valid containerElement to WebviewDisplay constructor')
    }
    this.shouldRemoveOnDestroy = shouldRemoveOnDestroy
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
    console.log(`Adding ${poolDeficit} webview(s)`)
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

  getPooledWebview () {
    this.ensureWebviewPoolSize()
    return this.webviewPool.pop()
  }

  createPooledWebview () {
    console.log('creating a webview')
    const webview = document.createElement('webview')
    webview.classList.add(this.classNameWebview)
    // webview is not usable if a WebContents is destroyed whilst attached.
    // We try to avoid this happening, but it's inveitable, so replace the webview
    // when that happens.
    const onContentsDestroyed = () => {
      console.log('contents destroyed')
      // no longer attached
      if (this.attachedWebview === webview) {
        this.attachedWebview = null
      }
      // webview.detachGuest()
      // return to pool
      this.webviewPool.push(webview)
    }
    webview.addEventListener('will-destroy', onContentsDestroyed)
    if (this.onFocus) {
      webview.addEventListener('focus', this.onFocus)
    }
    return webview
  }


  attachActiveTab (guestInstanceId) {
    console.log(`attachActiveTab`, guestInstanceId)
    if (guestInstanceId == null) {
      throw new Error('guestInstanceId is not valid')
    }
    // do nothing if repeat call to same guest Id as attached or attaching
    if (
      (!this.attachingToGuestInstanceId && guestInstanceId === this.activeGuestInstanceId) ||
      guestInstanceId === this.attachingToGuestInstanceId
    ) {
      console.log('already attaching this guest, nothing to do.')
      return
    }
    // are we waiting to attach to something different already?
    if (this.attachingToGuestInstanceId != null) {
      // wait for that attach to finish, and queue this one up to then display
      // if we have something already in the queue, then remove it
      console.log('attach already in progress, queuing replacement guest')
      this.attachingToGuestInstanceId = guestInstanceId
      return
    }
    // fresh attach
    this.swapWebviewOnAttach(guestInstanceId, this.getPooledWebview(), this.attachedWebview)
  }

  swapWebviewOnAttach(guestInstanceId, toAttachWebview, lastAttachedWebview) {
    console.log('swapWebviewOnAttach', guestInstanceId)
    console.group(`attach ${guestInstanceId}`)
    console.log(`Using webview #${toAttachWebview.dataset.webviewReplaceCount}`)

    this.attachingToGuestInstanceId = guestInstanceId
    const t0 = window.performance.now()
    let timeoutHandleBumpView = null

    // fn for guest did attach, and workaround to force paint
    const onToAttachDidAttach = () => {
      // don't need to bump view
      clearTimeout(timeoutHandleBumpView)
      toAttachWebview.removeEventListener('did-attach', onToAttachDidAttach)
      console.log(`webview did-attach ${window.performance.now() - t0}ms`)
      // TODO(petemill) remove ugly workaround as <webview>
      // will often not paint guest unless
      // size has changed or forced to.
      if (!toAttachWebview.isSubsequentAttach) {
        toAttachWebview.isSubsequentAttach = true
        ensurePaintWebviewFirstAttach(toAttachWebview, showAttachedView)
      } else {
        ensurePaintWebviewSubsequentAttach(toAttachWebview, showAttachedView)
      }
    }

    // fn for smoothly hiding the previously active view before showing this one
    const showAttachedView = async () => {
      // if (timeoutHandleShowAttachedView === null) {
      //   console.log(`not running show because already done ${window.performance.now() - t0}ms`)
      //   return
      // }
      // window.clearTimeout(timeoutHandleShowAttachedView)
      // timeoutHandleShowAttachedView = null
      // if we have decided to show a different guest in the time it's taken to attach and show
      // then do not show the intermediate, instead detach it and wait for the next attach
      if (guestInstanceId !== this.attachingToGuestInstanceId) {
        console.log('detaching guest from just attached view because it was not the desired guest anymore')
        await toAttachWebview.detachGuest()
        // if it happens to be the webview which is already being shown
        if (this.attachingToGuestInstanceId === this.activeGuestInstanceId) {
          // release everything and do not continue
          this.webviewPool.push(toAttachWebview)
          this.attachingToGuestInstanceId = null
          console.log('Asked to show already-attached view, so leaving that alone and returning new attached to pool')
          console.groupEnd()
          return
        }
        // start again, but with different guest
        console.log('Asked to show a different guest than the one we just attached, continuing with that one')
        console.groupEnd()
        this.swapWebviewOnAttach(this.attachingToGuestInstanceId, toAttachWebview, lastAttachedWebview)
        return
      }
      console.log(`webview showing ${window.performance.now() - t0}ms`)

      // got to the point where we are attached to the guest we *still* want to be displaying
      this.activeGuestInstanceId = guestInstanceId
      this.attachedWebview = toAttachWebview
      this.attachingToGuestInstanceId = null

      toAttachWebview.classList.add(this.classNameWebviewAttached)

      // If we were showing another frame, we wait for this new frame to display before
      // hiding (and removing) the other frame's webview, so that we avoid a white flicker
      // between attach.
      if (lastAttachedWebview) {
        lastAttachedWebview.classList.remove(this.classNameWebviewAttached)
        console.log('detaching guest from last attached webview...')
        await lastAttachedWebview.detachGuest()
        // return to the pool,
        console.log('...finished detach. returning detached webview to pool')
        this.webviewPool.push(lastAttachedWebview)
      }
      this.removePendingWebviews()
      console.groupEnd()
    }

    toAttachWebview.addEventListener('did-attach', onToAttachDidAttach)
    console.log('attaching active guest instance ', guestInstanceId, 'to webview', toAttachWebview)
    toAttachWebview.attachGuest(guestInstanceId)
    // another workaround for not getting did-attach on webview, set a timeout and then hide / show view
    timeoutHandleBumpView = window.setTimeout(ensurePaintWebviewFirstAttach.bind(null, toAttachWebview), 2000)
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
