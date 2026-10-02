// Evaluates JavaScript in the debug app's WebView on an Android emulator via the Chrome DevTools
// Protocol and prints the (awaited) result as JSON. Dev tooling for native tests – see README.md
// ("Skridt fra Apple Sundhed / Health Connect"). Needs Node 22+ (global WebSocket) and a forwarded
// DevTools socket:
//
//   adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof dk.meploy.fitnessapp)
//   node scripts/android-webview-eval.mjs 'location.pathname'
//
// CDP_PORT overrides the port (default 9222).
const expression = process.argv[2];
if (!expression) {
  console.error('Usage: node scripts/android-webview-eval.mjs "<expression>"');
  process.exit(1);
}
const port = process.env.CDP_PORT ?? '9222';
const targets = await (await fetch(`http://localhost:${port}/json`)).json();
const page = targets.find((target) => target.type === 'page') ?? targets[0];
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve));
socket.send(
  JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, awaitPromise: true, returnByValue: true },
  }),
);
const reply = await new Promise((resolve) =>
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id === 1) {
      resolve(message);
    }
  }),
);
const { result, exceptionDetails } = reply.result ?? {};
console.log(JSON.stringify(exceptionDetails ?? result?.value ?? reply, null, 1));
socket.close();
