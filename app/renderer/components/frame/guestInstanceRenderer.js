const React = require('react')
const {StyleSheet, css} = require('aphrodite/no-important')
const ReduxComponent = require('../reduxComponent')

// Actions
const appActions = require('../../../../js/actions/appActions')
const tabActions = require('../../../common/actions/tabActions')
const windowActions = require('../../../../js/actions/windowActions')

// state
const frameStateUtil = require('../../../../js/state/frameStateUtil')
const tabState = require('../../../common/state/tabState')

// utils
const contextMenus = require('../../../../js/contextMenus')
const imageUtil = require('../../../../js/lib/imageUtil')
const domUtil = require('../../lib/domUtil')
const HrefPreview = require('./hrefPreview')
const MessageBox = require('../common/messageBox')
const FullScreenWarning = require('./fullScreenWarning')

class GuestInstanceRenderer extends React.Component {
  constructor (props) {
    super(props)
    this.setWebviewRef = this.setWebviewRef.bind(this)
    // required because of calling detach() on the original contents, see below
    console.log('making a new single-webview for tab', props.tabId)
    this.tabId = props.tabId
    this.frameKey = props.frameKey
    this.guestInstanceId = props.guestInstanceId
  }

  mergeProps (state, ownProps) {
    const frameKey = ownProps.frameKey
    const frame = frameStateUtil.getFrameByKey(state.get('currentWindow'), frameKey)
    const tab = frame && tabState.getByTabId(state, frame.get('tabId'))

    const props = {
      tab,
      frame,
      guestInstanceId: frame && frame.get('guestInstanceId'),
      tabId: tab && tab.get('tabId'),
      frameKey: frameKey,
      transitionState: ownProps.transitionState
    }
    return props
  }

  componentDidMount () {
    const nextGuestInstanceId = this.props.frame && this.props.frame.get('guestInstanceId')
    if (nextGuestInstanceId != null && this.webview) {
      console.log('attaching guest (mount)', nextGuestInstanceId)
      this.webview.parentElement.setAttribute('data-active-guest-instance-id', nextGuestInstanceId)
      this.webview.parentElement.setAttribute('data-attacher', 'componentDidMount')
      this.webview.attachGuest(nextGuestInstanceId)
      window.requestAnimationFrame(() => {
        this.webview.style.visibility = 'hidden'
        window.requestAnimationFrame(() => {
          this.webview.style.visibility = ''
        })
      })
    }
  }

  componentDidUpdate (prevProps, prevState) {
    // attach new guest instance
//    console.log('frame componentDidUpdate', {prevProps, props: this.props}, this.webview)
    // if (this.webview && prevProps.frame !== this.props.frame) {
    // //  console.log('single-webview active tab Id', this.props.frame.get('tabId'))
    //   const prevGuestInstanceId = prevProps.frame && prevProps.frame.get('guestInstanceId')
    //   const nextGuestInstanceId = this.props.frame && this.props.frame.get('guestInstanceId')
    //   if (prevGuestInstanceId !== nextGuestInstanceId) {
    //     console.log(this.tabId, 'Guest instance ID changed, but not attaching...', nextGuestInstanceId)
    //     this.webview.parentElement.setAttribute('data-active-guest-instance-id', nextGuestInstanceId)
    //     this.webview.parentElement.setAttribute('data-attacher', 'componentDidUpdate')
    //   }
    // }
    }
  }

  setWebviewRef (ref) {
//    console.log('single-webview ref', this.webview)
    this.webview = ref
    if (this.webview && !this.addedEventListeners) {
      this.addedEventListeners = true

      this.webview.addEventListener('focus', this.onFocus.bind(this), { passive: true })
      this.webview.addEventListener('will-destroy', () => {
        this.webview.detachGuest()
      })
      // this.webview.addEventListener('context-menu', (e) => {
      //   console.log('context menu', e)
      //   contextMenus.onMainContextMenu(e.params, this.props.activeFrame, this.props.activeTab)
      //   e.preventDefault()
      //   e.stopPropagation()
      // })

      this.webview.addEventListener('update-target-url', (e) => {
        console.log('update target url')
        const downloadBarHeight = domUtil.getStyleConstants('download-bar-height')
        let nearBottom = e.y > (window.innerHeight - 150 - downloadBarHeight)
        let mouseOnLeft = e.x < (window.innerWidth / 2)
        let showOnRight = nearBottom && mouseOnLeft
        windowActions.setLinkHoverPreview(e.url, showOnRight)
      }, { passive: true })

      this.webview.addEventListener('mouseenter', (e) => {
        windowActions.onFrameMouseEnter()
      }, { passive: true })

      this.webview.addEventListener('mouseleave', (e) => {
        windowActions.onFrameMouseLeave()
      }, { passive: true })
    }
  }

  onFocus () {
    if (this.props.activeFrame && !this.props.activeFrame.isEmpty()) {
      windowActions.setTabPageIndexByFrame(this.props.activeFrame)
      windowActions.tabOnFocus(this.props.tabId)
    }

    windowActions.setContextMenuDetail()
    windowActions.setPopupWindowDetail()
  }

  render () {
    const { tabId, frameKey } = this.props
    if (tabId == null || frameKey == null) return null
    return (
      <div
        className={css(styles.guestInstanceRenderer)}
        >
        <webview
          className={css(styles.guestInstanceRenderer__webview)}
          ref={ref => this.setWebviewRef(ref)}
        />
        <HrefPreview frameKey={frameKey} />
        {
          this.props.showMessageBox
          ? <MessageBox
            tabId={tabId} />
          : null
        }
      </div>
    )
  }
}

const styles = StyleSheet.create({
  guestInstanceRenderer: {
    display: 'flex',
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 100,
    '--frame-bg': '#fff'
  },

  guestInstanceRenderer_exiting: {
    zIndex: 110
  },

  guestInstanceRenderer__webview: {
    flex: 1,
    backgroundColor: 'var(--frame-bg)'
  }
})

module.exports = ReduxComponent.connect(GuestInstanceRenderer)
