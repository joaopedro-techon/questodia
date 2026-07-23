'use strict';

// Wrapper fino sobre o cliente Socket.IO (servido pelo próprio servidor em
// /socket.io/socket.io.js). Oferece emitAsync com ack em forma de Promise.
(function () {
  function createClient() {
    const socket = io();

    function emitAsync(event, payload) {
      return new Promise((resolve) => {
        socket.emit(event, payload, (response) => resolve(response));
      });
    }

    return { socket, emitAsync };
  }

  window.QuestodiaClient = { createClient };
})();
