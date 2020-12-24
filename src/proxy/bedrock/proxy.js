const fs = require('fs')
const java = require('java')

let child
let storedCallback

// TODO: Can it still be frozen?
let mayBeFrozen = false
let timeFrozen

let proxyPass
let proxyPlayerSession

// This whole thing is messy for now.

exports.capabilities = {
  modifyPackets: true,
  jsonData: true,
  rawData: true,
  scriptingSupport: false,
  clientboundPackets: {},
  serverboundPackets: {},
  wikiVgPage: 'https://wiki.vg/Bedrock_Protocol',
  versionId: 'bedrock-proxypass-json'
}

exports.startProxy = function (host, port, listenPort, version, authConsent, callback, dataFolder) {
  java.classpath.push(dataFolder + '/proxypass/proxypass-pakkit.jar')

  proxyPass = java.import('com.nukkitx.proxypass.ProxyPass')
  proxyPlayerSession = java.import('com.nukkitx.proxypass.network.bedrock.session.ProxyPlayerSession')

  const packetTypes = JSON.parse(proxyPlayerSession.getIdBiMapStaticSync())
  for (const index in packetTypes) {
    const idString = '0x' + Number(index).toString(16).padStart(2, '0')
    const name = packetTypes[index].toLowerCase()
    // There isn't much of a distinction between serverbound and clientbound in Bedrock and many packets can be sent both ways
    exports.capabilities.clientboundPackets[idString] = name
    exports.capabilities.serverboundPackets[idString] = name
  }

  storedCallback = callback

  console.log(proxyPass)
  proxyPass.startFromArgs('0.0.0.0', Number(listenPort), host, Number(port), 1, true, true, "pakkit", "pakkit proxy powered by ProxyPass", function(err, test) {
    console.log(err, test)
  })

  // Poll for packets as the java module doesn't seem to support callbacks
  setInterval(function () {
    const array = proxyPass.packetQueue.toArraySync()
    for (const item of array) {
      const name = item.packetType.toStringSync().toLowerCase();

      const data = JSON.parse(item.jsonData);
      const hexIdString = '0x' + item.packetId.toString(16).padStart(2, '0')

      // These values are unneeded or are exposed elsewhere in the GUI
      delete data.packetId
      delete data.packetType
      delete data.clientId
      delete data.senderId

      const raw = Object.values(item.bytes)
      // Prepend packet ID for consistency with Java Edition
      raw.unshift(item.packetId)

      storedCallback(item.direction, { name: name, className: item.className }, data, hexIdString, raw)
    }

    proxyPass.packetQueue.clearSync()
  }, 50)

  console.log('Proxy started (Bedrock)!')
}

exports.end = function () {
  proxyPass.shutdownStatic(function(err, test) {
    console.log(err, test)
  });
}

exports.writeToClient = function (meta, data) {
  proxyPlayerSession.injectPacketStaticSync(JSON.stringify(data), meta.className, 'client')
}

exports.writeToServer = function (meta, data) {
  proxyPlayerSession.injectPacketStaticSync(JSON.stringify(data), meta.className, 'server')
}
