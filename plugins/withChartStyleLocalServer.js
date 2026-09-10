/**
 * Persist ChartStyleLocalServer + localhost cleartext + chart-style asset across prebuild.
 * Android OfflineManager createPack needs http://127.0.0.1:18765/chart-style.json.
 */
const {
  withDangerousMod,
  withMainApplication,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KT_REL = 'app/src/main/java/de/softwarebydesign/seacheck/ChartStyleLocalServer.kt';
const XML_REL = 'app/src/main/res/xml/network_security_config.xml';
const START_MARKER = 'ChartStyleLocalServer.start(this)';

const KT_SOURCE = `package de.softwarebydesign.seacheck

import android.content.Context
import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Serves bundled assets/map/chart-style.json on loopback :18765 for MapLibre OfflineManager.
 */
object ChartStyleLocalServer {
  private const val TAG = "ChartStyleLocalServer"
  const val PORT = 18765
  private const val ASSET_PATH = "map/chart-style.json"

  private val running = AtomicBoolean(false)
  @Volatile private var serverSocket: ServerSocket? = null
  @Volatile private var acceptThread: Thread? = null

  fun start(context: Context) {
    if (!running.compareAndSet(false, true)) return
    val appContext = context.applicationContext
    acceptThread = thread(name = "ChartStyleLocalServer", isDaemon = true) {
      try {
        val ss = ServerSocket(PORT, 8, InetAddress.getByName("127.0.0.1"))
        serverSocket = ss
        Log.i(TAG, "listening on 127.0.0.1:\$PORT")
        while (running.get()) {
          val client = try {
            ss.accept()
          } catch (_: Exception) {
            break
          }
          thread(name = "ChartStyleLocalServer-worker", isDaemon = true) {
            handleClient(appContext, client)
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "failed to bind :\$PORT", e)
        running.set(false)
      } finally {
        try {
          serverSocket?.close()
        } catch (_: Exception) {
        }
        serverSocket = null
      }
    }
  }

  fun stop() {
    running.set(false)
    try {
      serverSocket?.close()
    } catch (_: Exception) {
    }
    serverSocket = null
    acceptThread = null
  }

  private fun handleClient(context: Context, socket: Socket) {
    socket.use { client ->
      try {
        val reader = BufferedReader(InputStreamReader(client.getInputStream()))
        val requestLine = reader.readLine() ?: return
        while (true) {
          val line = reader.readLine() ?: break
          if (line.isEmpty()) break
        }
        val path = requestLine.split(" ").getOrNull(1) ?: "/"
        val out = client.getOutputStream()
        if (path == "/chart-style.json" || path.startsWith("/chart-style.json?")) {
          val body = context.assets.open(ASSET_PATH).use { it.readBytes() }
          writeResponse(out, 200, "application/json; charset=utf-8", body)
        } else {
          writeResponse(out, 404, "text/plain; charset=utf-8", "not found".toByteArray())
        }
      } catch (e: Exception) {
        Log.w(TAG, "client error", e)
      }
    }
  }

  private fun writeResponse(out: OutputStream, code: Int, contentType: String, body: ByteArray) {
    val status = when (code) {
      200 -> "OK"
      404 -> "Not Found"
      else -> "Error"
    }
    val header =
      "HTTP/1.1 \$code \$status\\r\\n" +
        "Content-Type: \$contentType\\r\\n" +
        "Content-Length: \${body.size}\\r\\n" +
        "Connection: close\\r\\n" +
        "\\r\\n"
    out.write(header.toByteArray(Charsets.US_ASCII))
    out.write(body)
    out.flush()
  }
}
`;

const XML_SOURCE = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">localhost</domain>
  </domain-config>
  <base-config cleartextTrafficPermitted="false" />
</network-security-config>
`;

function writeChartStyleFiles(androidRoot) {
  const ktPath = path.join(androidRoot, KT_REL);
  const xmlPath = path.join(androidRoot, XML_REL);
  fs.mkdirSync(path.dirname(ktPath), { recursive: true });
  fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
  fs.writeFileSync(ktPath, KT_SOURCE);
  fs.writeFileSync(xmlPath, XML_SOURCE);
}

function withChartStyleLocalServer(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      writeChartStyleFiles(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);

  config = withMainApplication(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (contents.includes(START_MARKER)) {
      return cfg;
    }
    if (!contents.includes('override fun onCreate()')) {
      return cfg;
    }
    cfg.modResults.contents = contents.replace(
      /override fun onCreate\(\) \{\s*\n\s*super\.onCreate\(\)/,
      (match) => `${match}\n    // Loopback chart-style for OfflineManager createPack.\n    ${START_MARKER}`,
    );
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });

  return config;
}

module.exports = withChartStyleLocalServer;
