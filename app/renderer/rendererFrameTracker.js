const Immutable = require('immutable')
const windowStore = require('../../js/stores/windowStore')
const frameState = require('../common/state/frameState')
const appActions = require('../../js/actions/appActions')
const debounce = require('../../js/lib/debounce')

module.exports = function trackFrameChanges () {
  // relay frame changes back to browser
  let state = windowStore.state
  windowStore.addChangeListener(debounce(() => {
    const t0 = performance.now()
    const lastState = state
    state = windowStore.state
    const currentFrames = state.get('frames')
    if (!currentFrames) {
      return
    }
    const changedFrames = []
    for (const frame of currentFrames.valueSeq()) {
      if (frame.isEmpty()) {
        continue
      }
      const frameKey = frame.get('key')
      // does it exist in the last version of state?
      const lastFrame = frameState.getByFrameKey(lastState, frameKey)
      if (!lastFrame || !lastFrame.delete('lastAccessedTime').equals(frame.delete('lastAccessedTime'))) {
        console.log(`frame changed: ${frameKey}`)
        changedFrames.push(Immutable.Map().set('frame', frame))
      }
    }
    if (changedFrames.length) {
      appActions.framesChanged(changedFrames)
    }
    console.log(`Spent ${performance.now() - t0}ms figuring out frame changes`)
  }, 200))
}
