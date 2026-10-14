import AppKit
import WebKit

struct LocalConfiguration {
    let workspace: URL
    let node: URL
    let entry: URL

    init() throws {
        guard let file = Bundle.main.url(forResource: "LocalConfiguration", withExtension: "plist"),
              let values = try PropertyListSerialization.propertyList(from: Data(contentsOf: file), format: nil) as? [String: String],
              let directory = values["WorkspacePath"], let executable = values["NodePath"],
              let address = values["AdminURL"], let url = URL(string: address),
              url.scheme == "http", url.host == "127.0.0.1", url.port == 5174 else {
            throw NSError(domain: "LittleHouseFlower", code: 1, userInfo: [NSLocalizedDescriptionKey: "The local app configuration is missing or invalid. Rebuild the app from its workspace."])
        }
        workspace = URL(fileURLWithPath: directory, isDirectory: true)
        node = URL(fileURLWithPath: executable)
        entry = url
    }

    func permits(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == entry.scheme && url.host == entry.host && url.port == entry.port && url.user == nil && url.password == nil
    }
}

@MainActor
final class StudioApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSMenuItemValidation {
    private var settings: LocalConfiguration!
    private var window: NSWindow!
    private var web: WKWebView!
    private var connectionPanel: NSView!
    private var heading: NSTextField!
    private var explanation: NSTextField!
    private var retry: NSButton!
    private var spinner: NSProgressIndicator!
    private var starting = false
    private var startProcess: Process?
    private var connectionGeneration = 0
    private var auxiliaryWindows: [ObjectIdentifier: NSWindow] = [:]
    private var printViews: [ObjectIdentifier: WKWebView] = [:]
    private var printSources: [ObjectIdentifier: WKWebView] = [:]
    private let smokeMode = ProcessInfo.processInfo.arguments.contains("--smoke-test")
    private let clearTestSession = ProcessInfo.processInfo.arguments.contains("--clear-test-session")
    private let smokeStartedAt = Date()
    private let smokeRoutes = ["today", "orders", "calendar", "earnings", "settings"]
    private var smokeRouteIndex = 0
    private var smokeRows: [[String: Any]] = []
    private var smokeErrors: [[String: Any]] = []
    private var smokeRunning = false
    private var smokeFinished = false
    private var smokeLoginClicked = false
    private var smokeScreenshotSaved = false
    private var discardPromptShowing = false
    private var closeCheckPending = false
    private var closeApproved = false
    private var mainWindowClosed = false
    private var terminationCheckPending = false
    private var reloadCheckPending = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        do { settings = try LocalConfiguration() }
        catch {
            let alert = NSAlert()
            alert.messageText = "Little House Flower could not open"
            alert.informativeText = error.localizedDescription
            alert.runModal()
            NSApp.terminate(nil)
            return
        }
        installMenu()
        makeWindow()
        if smokeMode {
            writeSmokeReport(status: "running", reason: "Starting native WKWebView checks")
            DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in
                guard let self, !self.smokeFinished else { return }
                self.finishSmoke(false, reason: "Native smoke test exceeded its 25-second overall deadline")
            }
        }
        if clearTestSession && !smokeMode { clearLoopbackStaffCookie { [weak self] in self?.connect() } }
        else { connect() }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if smokeMode || mainWindowClosed || web == nil { return .terminateNow }
        if terminationCheckPending { return .terminateLater }
        if discardPromptShowing || closeCheckPending || reloadCheckPending { return .terminateCancel }
        terminationCheckPending = true
        confirmDiscard(for: "quit Little House Flower") { [weak self] allowed in
            self?.terminationCheckPending = false
            sender.reply(toApplicationShouldTerminate: allowed)
        }
        return .terminateLater
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard sender === window, !smokeMode else { return true }
        if closeApproved { closeApproved = false; return true }
        guard !closeCheckPending, !terminationCheckPending, !reloadCheckPending, !discardPromptShowing else { return false }
        closeCheckPending = true
        confirmDiscard(for: "close this window") { [weak self, weak sender] allowed in
            guard let self else { return }
            self.closeCheckPending = false
            if allowed { self.closeApproved = true; sender?.performClose(nil) }
        }
        return false
    }

    func windowWillClose(_ notification: Notification) {
        if notification.object as? NSWindow === window { mainWindowClosed = true }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        mainWindowClosed = false
        window.makeKeyAndOrderFront(nil)
        return true
    }

    private func makeWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 940), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Little House Flower Studio"
        window.delegate = self
        window.minSize = NSSize(width: 960, height: 680)
        window.setFrameAutosaveName("LittleHouseFlowerStudioWindow")
        window.center()
        window.isReleasedWhenClosed = false
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = smokeMode ? .nonPersistent() : .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        installPrintBridge(configuration)
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        let root = NSView()
        window.contentView = root
        root.addSubview(web)
        NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo: root.leadingAnchor), web.trailingAnchor.constraint(equalTo: root.trailingAnchor), web.topAnchor.constraint(equalTo: root.topAnchor), web.bottomAnchor.constraint(equalTo: root.bottomAnchor)])

        connectionPanel = NSView()
        connectionPanel.wantsLayer = true
        connectionPanel.layer?.backgroundColor = NSColor(calibratedRed: 0.98, green: 0.97, blue: 0.95, alpha: 1).cgColor
        connectionPanel.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(connectionPanel)
        NSLayoutConstraint.activate([connectionPanel.leadingAnchor.constraint(equalTo: root.leadingAnchor), connectionPanel.trailingAnchor.constraint(equalTo: root.trailingAnchor), connectionPanel.topAnchor.constraint(equalTo: root.topAnchor), connectionPanel.bottomAnchor.constraint(equalTo: root.bottomAnchor)])
        heading = NSTextField(labelWithString: "Opening Little House Flower")
        heading.font = NSFont.systemFont(ofSize: 25, weight: .semibold)
        heading.alignment = .center
        explanation = NSTextField(wrappingLabelWithString: "Connecting to your local studio…")
        explanation.font = NSFont.systemFont(ofSize: 14)
        explanation.textColor = .secondaryLabelColor
        explanation.alignment = .center
        spinner = NSProgressIndicator()
        spinner.style = .spinning
        spinner.controlSize = .regular
        retry = NSButton(title: "Retry", target: self, action: #selector(retryConnection))
        retry.bezelStyle = .rounded
        let stack = NSStackView(views: [spinner, heading, explanation, retry])
        stack.orientation = .vertical
        stack.spacing = 18
        stack.alignment = .centerX
        stack.translatesAutoresizingMaskIntoConstraints = false
        connectionPanel.addSubview(stack)
        NSLayoutConstraint.activate([stack.centerXAnchor.constraint(equalTo: connectionPanel.centerXAnchor), stack.centerYAnchor.constraint(equalTo: connectionPanel.centerYAnchor), stack.widthAnchor.constraint(lessThanOrEqualToConstant: 650), stack.leadingAnchor.constraint(greaterThanOrEqualTo: connectionPanel.leadingAnchor, constant: 40), stack.trailingAnchor.constraint(lessThanOrEqualTo: connectionPanel.trailingAnchor, constant: -40), explanation.widthAnchor.constraint(lessThanOrEqualToConstant: 620)])
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func clearLoopbackStaffCookie(_ completion: @escaping @MainActor () -> Void) {
        status("Opening Little House Flower", "Clearing the earlier test sign-in from this app…", busy: true)
        let store = web.configuration.websiteDataStore.httpCookieStore
        store.getAllCookies { [weak self] cookies in
            let matches = cookies.filter { $0.name == "lhf_staff" && ["127.0.0.1", ".127.0.0.1"].contains($0.domain) }
            Task { @MainActor in self?.removeTestCookies(matches, from: store, completion: completion) }
        }
    }

    private func removeTestCookies(_ cookies: [HTTPCookie], from store: WKHTTPCookieStore, completion: @escaping @MainActor () -> Void) {
        guard let first = cookies.first else { completion(); return }
        store.delete(first) { [weak self] in
            Task { @MainActor in self?.removeTestCookies(Array(cookies.dropFirst()), from: store, completion: completion) }
        }
    }

    private func confirmDiscard(for action: String, completion: @escaping @MainActor (Bool) -> Void) {
        guard !smokeMode, let web else { completion(true); return }
        if discardPromptShowing { completion(false); return }
        var responded = false
        let decide: @MainActor (Bool, Bool) -> Void = { [weak self] dirty, unavailable in
            guard !responded else { return }
            responded = true
            guard let self else { completion(false); return }
            guard dirty || unavailable else { completion(true); return }
            if self.discardPromptShowing { completion(false); return }
            self.discardPromptShowing = true
            let alert = NSAlert()
            alert.alertStyle = .warning
            alert.messageText = unavailable ? "The studio could not check your draft" : "Keep your unsaved changes?"
            alert.informativeText = unavailable ? "The page is not responding. If you \(action), any unsaved edits may be lost." : "You have unsaved order changes. Discard them to \(action), or keep editing."
            alert.addButton(withTitle: "Keep editing")
            alert.addButton(withTitle: "Discard changes")
            alert.beginSheetModal(for: self.window) { response in
                self.discardPromptShowing = false
                completion(response == .alertSecondButtonReturn)
            }
        }
        web.evaluateJavaScript("(() => typeof window.LHFStudioHasUnsavedChanges === 'function' ? window.LHFStudioHasUnsavedChanges() === true : false)()") { result, error in
            if error != nil { decide(false, true) }
            else { decide(result as? Bool == true, false) }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { decide(false, true) }
    }

    @objc private func retryConnection() { connect() }

    private func status(_ title: String, _ message: String, busy: Bool) {
        connectionPanel.isHidden = false
        heading.stringValue = title
        explanation.stringValue = message
        retry.isHidden = busy
        spinner.isHidden = !busy
        if busy { spinner.startAnimation(nil) } else { spinner.stopAnimation(nil) }
        if smokeMode && !busy && !smokeFinished { finishSmoke(false, reason: "\(title): \(message)") }
    }

    private func health(_ completion: @escaping @MainActor (Bool) -> Void) {
        var request = URLRequest(url: settings.entry.appendingPathComponent("api/health"))
        request.timeoutInterval = 2
        request.cachePolicy = .reloadIgnoringLocalCacheData
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let body = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            let valid = (response as? HTTPURLResponse)?.statusCode == 200 && body?["ok"] as? Bool == true && body?["mode"] as? String == "local-only"
            Task { @MainActor in completion(valid) }
        }.resume()
    }

    private func connect() {
        guard !starting else { return }
        connectionGeneration += 1
        let generation = connectionGeneration
        status("Opening Little House Flower", "Connecting to your local studio…", busy: true)
        health { [weak self] healthy in
            guard let self, generation == self.connectionGeneration else { return }
            if healthy { self.loadStudio() } else { self.startPreview(generation: generation) }
        }
    }

    private func loadStudio() {
        starting = false
        status("Opening Little House Flower", "Your local studio is ready. Loading the workspace…", busy: true)
        web.load(URLRequest(url: settings.entry, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func startPreview(generation: Int) {
        let script = settings.workspace.appendingPathComponent("scripts/preview.mjs")
        guard FileManager.default.isExecutableFile(atPath: settings.node.path), FileManager.default.fileExists(atPath: script.path) else {
            status("Local preview could not start", "The Node runtime or workspace launcher is missing. Restore the workspace, or rebuild this app from its new location, then retry.\n\nWorkspace: \(settings.workspace.path)", busy: false)
            return
        }
        starting = true
        status("Starting your local studio", "Starting the existing preview server. Your saved local orders and settings will be kept.", busy: true)
        let process = Process()
        let output = Pipe()
        process.executableURL = settings.node
        process.arguments = [script.path, "start"]
        process.currentDirectoryURL = settings.workspace
        process.standardOutput = output
        process.standardError = output
        startProcess = process
        process.terminationHandler = { [weak self] finished in
            let data = output.fileHandleForReading.readDataToEndOfFile()
            let detail = String(data: data.suffix(4000), encoding: .utf8) ?? ""
            Task { @MainActor in
                guard let self, generation == self.connectionGeneration else { return }
                self.startProcess = nil
                self.checkStarted(generation: generation, attempts: 10, detail: detail, exitCode: finished.terminationStatus)
            }
        }
        do { try process.run() }
        catch {
            starting = false
            startProcess = nil
            status("Local preview could not start", "\(error.localizedDescription)\n\nYou can start it in the workspace with npm run preview:start, then retry.", busy: false)
        }
    }

    private func checkStarted(generation: Int, attempts: Int, detail: String, exitCode: Int32) {
        health { [weak self] healthy in
            guard let self, generation == self.connectionGeneration else { return }
            if healthy { self.loadStudio(); return }
            if attempts > 1 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in self?.checkStarted(generation: generation, attempts: attempts - 1, detail: detail, exitCode: exitCode) }
            } else {
                self.starting = false
                self.status("Local preview is unavailable", "The local server did not become ready. Another program may be using its port.\n\n\(detail.isEmpty ? "Read data/preview.log in the workspace for details." : detail)\n\nNo local data was removed. Start the preview in the workspace, then retry.", busy: false)
            }
        }
    }

    private func installPrintBridge(_ configuration: WKWebViewConfiguration) {
        let controller = WKUserContentController()
        controller.add(self, name: "nativePrint")
        controller.addUserScript(WKUserScript(source: """
        (() => {
          window.LHF_NATIVE_APP = true;
          if (window.__littleHouseNativePrint) return;
          window.__littleHouseNativePrint = true;
          window.print = () => {
            window.dispatchEvent(new Event('beforeprint'));
            const copy = document.documentElement.cloneNode(true);
            copy.querySelectorAll('script,iframe,object,embed,meta[http-equiv="refresh"]').forEach(node => node.remove());
            const originals = document.querySelectorAll('input,textarea,select');
            copy.querySelectorAll('input,textarea,select').forEach((node, index) => {
              const original = originals[index];
              if (!original) return;
              if (node.tagName === 'TEXTAREA') node.textContent = original.value;
              else if (node.tagName === 'SELECT') [...node.options].forEach((option, i) => { if (original.options[i]?.selected) option.setAttribute('selected', ''); else option.removeAttribute('selected'); });
              else { node.setAttribute('value', original.value); if (original.checked) node.setAttribute('checked', ''); else node.removeAttribute('checked'); }
            });
            window.webkit.messageHandlers.nativePrint.postMessage({html: '<!doctype html>' + copy.outerHTML, baseURL: document.baseURI});
          };
        })();
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController = controller
        if smokeMode {
            controller.addUserScript(WKUserScript(source: """
            window.__LHFNativeSmokeErrors = [];
            window.addEventListener('error', event => {
              if (window.__LHFNativeSmokeErrors.length < 20) window.__LHFNativeSmokeErrors.push({type:'error', message:String(event.message || 'Unknown JavaScript error'), source:String(event.filename || ''), line:event.lineno || 0});
            });
            window.addEventListener('unhandledrejection', event => {
              if (window.__LHFNativeSmokeErrors.length < 20) window.__LHFNativeSmokeErrors.push({type:'unhandledrejection', message:String(event.reason?.message || event.reason || 'Unknown rejected promise')});
            });
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativePrint", message.frameInfo.isMainFrame, let source = message.webView,
              source === web || auxiliaryWindows[ObjectIdentifier(source)] != nil,
              let data = message.body as? [String: String], let html = data["html"], html.utf8.count <= 4_000_000,
              let baseString = data["baseURL"], let base = URL(string: baseString), settings.permits(base) else { return }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = web.configuration.websiteDataStore
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        let printable = WKWebView(frame: NSRect(x: 0, y: 0, width: 1050, height: 1400), configuration: configuration)
        printable.navigationDelegate = self
        let identifier = ObjectIdentifier(printable)
        printViews[identifier] = printable
        printSources[identifier] = source
        printable.loadHTMLString(html, baseURL: base)
    }

    func webView(_ view: WKWebView, didFinish navigation: WKNavigation!) {
        if view === web { connectionPanel.isHidden = true; spinner.stopAnimation(nil) }
        if view === web && smokeMode && !smokeRunning && !smokeFinished {
            smokeRunning = true
            smokePoll()
        }
        let identifier = ObjectIdentifier(view)
        if printViews[identifier] != nil {
            let printInfo = NSPrintInfo.shared.copy() as! NSPrintInfo
            printInfo.topMargin = 28
            printInfo.bottomMargin = 28
            printInfo.leftMargin = 28
            printInfo.rightMargin = 28
            let operation = view.printOperation(with: printInfo)
            operation.jobTitle = "Little House Flower"
            operation.showsPrintPanel = true
            operation.showsProgressPanel = true
            operation.runModal(for: window, delegate: self, didRun: #selector(printFinished(_:success:contextInfo:)), contextInfo: Unmanaged.passRetained(view).toOpaque())
        }
    }

    @objc private func printFinished(_ operation: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) {
        guard let contextInfo else { return }
        let printed = Unmanaged<WKWebView>.fromOpaque(contextInfo).takeRetainedValue()
        let identifier = ObjectIdentifier(printed)
        printSources[identifier]?.evaluateJavaScript("window.dispatchEvent(new Event('afterprint'))", completionHandler: nil)
        printViews.removeValue(forKey: identifier)
        printSources.removeValue(forKey: identifier)
    }

    func webView(_ view: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(view, error) }
    func webView(_ view: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(view, error) }
    private func navigationFailed(_ view: WKWebView, _ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        if view === web { status("Local studio could not load", "\(error.localizedDescription)\n\nRetry to reconnect to the local preview. Your saved local data will be kept.", busy: false) }
        else if printViews.removeValue(forKey: ObjectIdentifier(view)) != nil {
            printSources.removeValue(forKey: ObjectIdentifier(view))
            let alert = NSAlert()
            alert.messageText = "The print preview could not load"
            alert.informativeText = error.localizedDescription
            alert.beginSheetModal(for: window)
        }
    }

    func webViewWebContentProcessDidTerminate(_ view: WKWebView) {
        if view === web { status("The studio window needs to reload", "The web view closed unexpectedly. Retry to reopen your saved local workspace.", busy: false) }
    }

    func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if settings.permits(url) || (url.absoluteString == "about:blank" && view !== web) { decisionHandler(.allow); return }
        if action.navigationType == .linkActivated && ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }

    func webView(_ view: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard action.targetFrame == nil else { return nil }
        if let url = action.request.url, settings.permits(url) { view.load(action.request); return nil }
        let address = action.request.url?.absoluteString ?? "about:blank"
        guard address == "about:blank", settings.permits(view.url) else {
            if action.navigationType == .linkActivated, let url = action.request.url, ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") { NSWorkspace.shared.open(url) }
            return nil
        }
        installPrintBridge(configuration)
        let child = WKWebView(frame: NSRect(x: 0, y: 0, width: 900, height: 760), configuration: configuration)
        child.navigationDelegate = self
        child.uiDelegate = self
        let childWindow = NSWindow(contentRect: child.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        childWindow.title = "Little House Flower — Document"
        childWindow.isReleasedWhenClosed = false
        childWindow.contentView = child
        childWindow.center()
        childWindow.makeKeyAndOrderFront(nil)
        auxiliaryWindows[ObjectIdentifier(child)] = childWindow
        return child
    }

    func webViewDidClose(_ view: WKWebView) { auxiliaryWindows.removeValue(forKey: ObjectIdentifier(view))?.close() }

    func webView(_ view: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "Little House Flower"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: view.window ?? window) { _ in completionHandler() }
    }

    func webView(_ view: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Little House Flower"
        alert.informativeText = message
        alert.addButton(withTitle: "Continue")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: view.window ?? window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }

    func webView(_ view: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Little House Flower"
        alert.informativeText = prompt
        let input = NSTextField(string: defaultText ?? "")
        input.frame = NSRect(x: 0, y: 0, width: 340, height: 24)
        alert.accessoryView = input
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: view.window ?? window) { response in completionHandler(response == .alertFirstButtonReturn ? input.stringValue : nil) }
    }

    private func installMenu() {
        let menu = NSMenu()
        let app = NSMenuItem()
        let appMenu = NSMenu(title: "Little House Flower")
        appMenu.addItem(withTitle: "About Little House Flower Studio", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Little House Flower", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Little House Flower", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        app.submenu = appMenu
        menu.addItem(app)
        let file = NSMenu(title: "File")
        file.addItem(withTitle: "Print…", action: #selector(printCurrent), keyEquivalent: "p")
        file.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        addMenu(file, to: menu)
        let edit = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Redo", "redo:", "Z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] { edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key) }
        addMenu(edit, to: menu)
        let view = NSMenu(title: "View")
        view.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r")
        view.addItem(withTitle: "Back", action: #selector(goBack), keyEquivalent: "[")
        view.addItem(withTitle: "Forward", action: #selector(goForward), keyEquivalent: "]")
        view.addItem(.separator())
        let fullscreen = view.addItem(withTitle: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fullscreen.keyEquivalentModifierMask = [.command, .control]
        addMenu(view, to: menu)
        let windows = NSMenu(title: "Window")
        windows.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windows.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windows.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        addMenu(windows, to: menu)
        NSApp.windowsMenu = windows
        NSApp.mainMenu = menu
    }

    private func addMenu(_ submenu: NSMenu, to menu: NSMenu) { let item = NSMenuItem(title: submenu.title, action: nil, keyEquivalent: ""); item.submenu = submenu; menu.addItem(item) }
    @objc private func about() { NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "Little House Flower Studio", .applicationVersion: "Local preview", .credits: NSAttributedString(string: "A local staff workspace. Closing this app leaves the preview server and saved local data available.")]) }
    @objc private func reload() {
        if !connectionPanel.isHidden { connect(); return }
        guard !reloadCheckPending, !closeCheckPending, !terminationCheckPending, !discardPromptShowing else { return }
        reloadCheckPending = true
        confirmDiscard(for: "reload the studio") { [weak self] allowed in
            guard let self else { return }
            self.reloadCheckPending = false
            if allowed { self.web.reloadFromOrigin() }
        }
    }
    @objc private func goBack() { web.goBack() }
    @objc private func goForward() { web.goForward() }
    @objc private func printCurrent() { let selected = (NSApp.keyWindow?.contentView as? WKWebView) ?? web!; selected.evaluateJavaScript("window.print()", completionHandler: nil) }
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(goBack) { return web?.canGoBack == true }
        if menuItem.action == #selector(goForward) { return web?.canGoForward == true }
        if menuItem.action == #selector(printCurrent) { return connectionPanel?.isHidden == true }
        return true
    }

    private func smokePoll() {
        guard smokeMode, !smokeFinished else { return }
        let probe = """
        (() => ({
          hash: location.hash.slice(1),
          heading: document.querySelector('#view h1')?.textContent.trim() || '',
          skeleton: !!document.querySelector('#view .skeleton'),
          title: document.title,
          nativeFlag: window.LHF_NATIVE_APP === true,
          loginAvailable: !!document.querySelector('.login form button[type="submit"]'),
          navigation: [...document.querySelectorAll('.navigation a')].map(a => ({href:a.getAttribute('href'), label:a.textContent.trim(), current:a.getAttribute('aria-current')})),
          pageErrors: window.__LHFNativeSmokeErrors || [],
          readyState: document.readyState
        }))()
        """
        web.evaluateJavaScript(probe) { [weak self] result, error in
            guard let self, !self.smokeFinished else { return }
            if let error { self.finishSmoke(false, reason: "Native JavaScript probe failed: \(error.localizedDescription)"); return }
            guard let state = result as? [String: Any] else { self.finishSmoke(false, reason: "Native JavaScript probe returned no state"); return }
            self.smokeErrors = state["pageErrors"] as? [[String: Any]] ?? []
            if !self.smokeErrors.isEmpty { self.finishSmoke(false, reason: "The native web view reported JavaScript errors"); return }
            if state["loginAvailable"] as? Bool == true {
                if !self.smokeLoginClicked {
                    self.smokeLoginClicked = true
                    self.web.evaluateJavaScript("(() => { const form = document.querySelector('.login form'); if (!form) return false; const role = form.querySelector('select'); if (role) role.value = 'read-only'; form.querySelector('button[type=submit]').click(); return true; })()", completionHandler: nil)
                }
                self.nextSmokePoll()
                return
            }
            let expected = self.smokeRoutes[self.smokeRouteIndex]
            let navigation = state["navigation"] as? [[String: Any]] ?? []
            let links = navigation.compactMap { $0["href"] as? String }
            let heading = state["heading"] as? String ?? ""
            let title = state["title"] as? String ?? ""
            let current = navigation.first { $0["current"] as? String == "page" }?["href"] as? String
            let ready = state["hash"] as? String == expected && state["skeleton"] as? Bool == false && !heading.isEmpty && current == "#" + expected
            guard ready else { self.nextSmokePoll(); return }
            guard heading != "Unable to load", links == self.smokeRoutes.map({ "#" + $0 }), state["nativeFlag"] as? Bool == true,
                  title.hasPrefix(expected.capitalized + " · ") else {
                self.smokeRows.append(state)
                self.finishSmoke(false, reason: "The \(expected) route failed its heading, five-link navigation, document title or native-flag check")
                return
            }
            var row = state
            row["route"] = expected
            row["passed"] = true
            self.smokeRows.append(row)
            if expected == "today" { self.captureSmokeWindow() }
            else { self.advanceSmokeRoute() }
        }
    }

    private func nextSmokePoll() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self] in self?.smokePoll() }
    }

    private func captureSmokeWindow() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            guard let self, !self.smokeFinished else { return }
            let options = WKSnapshotConfiguration()
            options.rect = self.web.bounds
            options.afterScreenUpdates = true
            self.web.takeSnapshot(with: options) { [weak self] image, error in
                guard let self, !self.smokeFinished else { return }
                guard let image, let tiff = image.tiffRepresentation,
                      let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) else {
                    self.finishSmoke(false, reason: "Native Today snapshot failed: \(error?.localizedDescription ?? "No PNG data")")
                    return
                }
                do {
                    let directory = self.settings.workspace.appendingPathComponent("docs/studio-app-qa", isDirectory: true)
                    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                    try png.write(to: directory.appendingPathComponent("native-window.png"), options: .atomic)
                    self.smokeScreenshotSaved = true
                    self.advanceSmokeRoute()
                } catch { self.finishSmoke(false, reason: "Native snapshot could not be saved: \(error.localizedDescription)") }
            }
        }
    }

    private func advanceSmokeRoute() {
        guard !smokeFinished else { return }
        smokeRouteIndex += 1
        if smokeRouteIndex == smokeRoutes.count {
            finishSmoke(smokeScreenshotSaved, reason: smokeScreenshotSaved ? "All five native WKWebView routes passed; Today snapshot saved" : "Today snapshot was not saved")
            return
        }
        let next = smokeRoutes[smokeRouteIndex]
        web.evaluateJavaScript("document.querySelector('.navigation a[href=\"#\(next)\"]').click()") { [weak self] _, error in
            guard let self, !self.smokeFinished else { return }
            if let error { self.finishSmoke(false, reason: "Native navigation click failed: \(error.localizedDescription)") }
            else { self.nextSmokePoll() }
        }
    }

    private func writeSmokeReport(status: String, reason: String) {
        guard smokeMode, let settings else { return }
        let directory = settings.workspace.appendingPathComponent("docs/studio-app-qa", isDirectory: true)
        let report: [String: Any] = [
            "status": status, "passed": status == "passed", "reason": reason,
            "startedAt": ISO8601DateFormatter().string(from: smokeStartedAt),
            "finishedAt": status == "running" ? NSNull() : ISO8601DateFormatter().string(from: Date()),
            "durationSeconds": Date().timeIntervalSince(smokeStartedAt),
            "entryURL": settings.entry.absoluteString, "engine": "Native macOS WKWebView", "windowTitle": window?.title ?? "",
            "nativeBundleID": Bundle.main.bundleIdentifier ?? "", "operatingSystem": ProcessInfo.processInfo.operatingSystemVersionString,
            "demoLoginClicked": smokeLoginClicked, "demoLoginRoleWhenNeeded": "read-only",
            "websiteDataStore": "nonpersistent isolated QA session",
            "routes": smokeRows, "pageErrors": smokeErrors, "screenshotSaved": smokeScreenshotSaved,
            "screenshotPath": directory.appendingPathComponent("native-window.png").path,
            "scope": "Read-only navigation plus local demo sign-in if needed. No orders, payment records, settings, print dialogs or deployment actions. The preview server is left running."
        ]
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: directory.appendingPathComponent("native-smoke.json"), options: .atomic)
        } catch { fputs("Native smoke report failed: \(error.localizedDescription)\n", stderr) }
    }

    private func finishSmoke(_ passed: Bool, reason: String) {
        guard smokeMode, !smokeFinished else { return }
        smokeFinished = true
        writeSmokeReport(status: passed ? "passed" : "failed", reason: reason)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { NSApp.terminate(nil) }
    }
}

@main
struct StudioLauncher {
    @MainActor
    static func main() {
        let application = NSApplication.shared
        let delegate = StudioApp()
        application.delegate = delegate
        application.setActivationPolicy(.regular)
        application.run()
        withExtendedLifetime(delegate) {}
    }
}
