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
  }

  mergeProps (state, ownProps) {
    const activeFrame = frameStateUtil.getActiveFrame(state.get('currentWindow'))
    const activeTab = activeFrame && tabState.getByTabId(state, activeFrame.get('tabId'))
    const props = {
      activeTab,
      activeFrame,
      guestInstanceId: activeFrame && activeFrame.get('guestInstanceId'),
      tabId: activeTab && activeTab.get('tabId'),
      frameKey: activeFrame && activeFrame.get('key')
    }
    return props
  }

  componentDidMount () {
    const nextGuestInstanceId = this.props.activeFrame && this.props.activeFrame.get('guestInstanceId')
    if (nextGuestInstanceId != null && this.webview) {
      console.log('attaching guest (mount)', nextGuestInstanceId)
      this.webview.parentElement.setAttribute('data-active-guest-instance-id', nextGuestInstanceId)
      this.webview.parentElement.setAttribute('data-attacher', 'componentDidMount')
      this.webview.attachGuest(nextGuestInstanceId)
    }
  }

  componentDidUpdate (prevProps, prevState) {
    // attach new guest instance
//    console.log('frame componentDidUpdate', {prevProps, props: this.props}, this.webview)
    if (this.webview && prevProps.activeFrame !== this.props.activeFrame) {
      console.log('single-webview active tab Id', this.props.activeFrame.get('tabId'))
      const prevGuestInstanceId = prevProps.activeFrame && prevProps.activeFrame.get('guestInstanceId')
      const nextGuestInstanceId = this.props.activeFrame && this.props.activeFrame.get('guestInstanceId')
      if (prevGuestInstanceId !== nextGuestInstanceId) {
        console.log('attaching guest', nextGuestInstanceId)
        this.webview.parentElement.setAttribute('data-active-guest-instance-id', nextGuestInstanceId)
        this.webview.parentElement.setAttribute('data-attacher', 'componentDidUpdate')
        this.webview.detachGuest()
        window.requestAnimationFrame(() => this.webview.attachGuest(nextGuestInstanceId))
      }
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
    flex: 1
  },
  guestInstanceRenderer__webview: {
    flex: 1
  }
})

module.exports = ReduxComponent.connect(GuestInstanceRenderer)
