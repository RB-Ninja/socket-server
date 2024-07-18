// io means whole server & socket means individual user

import { Server, Socket } from "socket.io";
import http from "http";
import express from "express";

const app = express();
app.use(express.static("public"));
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://192.168.1.6:5500", "http://127.0.0.1:5500"],
    methods: ["GET", "POST"],
  },
});
interface UserSocketMap {
  [userId: string]: string;
}

const userSocketMap: UserSocketMap = {}; // { userId : socketId }

const getReceiverSocketId = (receiverId: string): string | undefined => {
  return userSocketMap[receiverId];
};

io.on("connection", (socket: Socket) => {
  const userId: string | undefined = socket.handshake.query.userId as
    | string
    | undefined; // Sender user id (Local user)

  if (userId !== undefined) {
    userSocketMap[userId] = socket.id; // Assign user to their socket id => { userId : socketId }
    console.log(`User connected: ${userId}, Socket ID: ${socket.id}`);
  } else {
    console.log("User connected without userId");
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap)); // When new user connected this will called.
  console.log("Online users:", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    if (userId !== undefined) {
      delete userSocketMap[userId]; // Remove user id & socket id => { userId : socketId }
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      console.log(`User disconnected: ${userId}`);
      console.log("Online users:", Object.keys(userSocketMap));
    }
  });

  socket.on("callUser", ({ receiverId, signalData, callType }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incomingCall", {
        signalData,
        from: userId,
        callType,
      });
      console.log(`Call initiated from ${userId} to ${receiverId}`);
    } else {
      console.log(`Call initiation failed: ${receiverId} not found`);
    }
  });

  socket.on("answerCall", ({ to, signalData }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callAccepted", { signalData });
      console.log(`Call answered by ${userId} for ${to}`);
    } else {
      console.log(`Call answer failed: ${to} not found`);
    }
  });

  socket.on("rejectCall", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callRejected");
      console.log(`Call rejected by ${userId} for ${to}`);
    } else {
      console.log(`Call rejection failed: ${to} not found`);
    }
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("iceCandidate", { candidate });
      console.log(`ICE candidate sent from ${userId} to ${to}`);
    } else {
      console.log(`ICE candidate sending failed: ${to} not found`);
    }
  });

  socket.on("endCall", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callEnded");
      console.log(`Call ended by ${userId} for ${to}`);
    } else {
      console.log(`Call ending failed: ${to} not found`);
    }
  });
});

export { app, io, server, getReceiverSocketId };

// import { Server, Socket } from "socket.io";
// import http from "http";
// import express from "express";

// const app = express();
// app.use(express.static("public"));
// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: ["http://192.168.1.6:5500", "http://127.0.0.1:5500"],
//     methods: ["GET", "POST"],
//   },
// });

// interface UserSocketMap {
//   [userId: string]: string;
// }

// interface UserCallStatus {
//   [userId: string]: boolean;
// }

// const userSocketMap: UserSocketMap = {}; // { userId : socketId }
// const userCallStatus: UserCallStatus = {}; // { userId : inCall }

// const getReceiverSocketId = (receiverId: string): string | undefined => {
//   return userSocketMap[receiverId];
// };

// const isUserInCall = (userId: string): boolean => {
//   return userCallStatus[userId] === true;
// };

// io.on("connection", (socket: Socket) => {
//   const userId: string | undefined = socket.handshake.query.userId as
//     | string
//     | undefined; // Sender user id (Local user)

//   if (userId !== undefined) {
//     userSocketMap[userId] = socket.id; // Assign user to their socket id => { userId : socketId }
//     userCallStatus[userId] = false; // Initialize user call status to not in call
//     console.log(`User connected: ${userId}, Socket ID: ${socket.id}`);
//   } else {
//     console.log("User connected without userId");
//   }

//   io.emit("getOnlineUsers", Object.keys(userSocketMap)); // When new user connected this will called.
//   console.log("Online users:", Object.keys(userSocketMap));

//   socket.on("disconnect", () => {
//     if (userId !== undefined) {
//       delete userSocketMap[userId]; // Remove user id & socket id => { userId : socketId }
//       delete userCallStatus[userId]; // Remove user call status
//       io.emit("getOnlineUsers", Object.keys(userSocketMap));
//       console.log(`User disconnected: ${userId}`);
//       console.log("Online users:", Object.keys(userSocketMap));
//     }
//   });

//   socket.on("callUser", ({ receiverId, signalData, callType }) => {
//     const receiverSocketId = getReceiverSocketId(receiverId);
//     if (!receiverSocketId) {
//       console.log(`Call initiation failed: ${receiverId} not online`);
//       io.to(socket.id).emit("userNotOnline", { receiverId });
//       return;
//     }

//     if (isUserInCall(receiverId)) {
//       console.log(`Call initiation failed: ${receiverId} already in call`);
//       io.to(socket.id).emit("userInCall", { receiverId });
//       io.to(receiverSocketId).emit("incomingCallWhileBusy", { from: userId });
//       return;
//     }

//     io.to(receiverSocketId).emit("incomingCall", {
//       signalData,
//       from: userId,
//       callType,
//     });
//     console.log(`Call initiated from ${userId} to ${receiverId}`);

//     // Set a timeout to auto-reject the call after 30 seconds if not answered
//     const callTimeout = setTimeout(() => {
//       io.to(socket.id).emit("callTimeout", { receiverId });
//       io.to(receiverSocketId).emit("missedCall", { from: userId });
//       console.log(`Call from ${userId} to ${receiverId} timed out`);
//     }, 30000);

//     // Store the timeout so it can be cleared if the call is answered or rejected
//     socket.on("answerCall", ({ to, signalData }) => {
//       if (to === receiverId) {
//         clearTimeout(callTimeout);
//         userCallStatus[userId as string] = true;
//         userCallStatus[receiverId] = true;
//       }
//       const receiverSocketId = getReceiverSocketId(to);
//       if (receiverSocketId) {
//         io.to(receiverSocketId).emit("callAccepted", { signalData });
//         console.log(`Call answered by ${userId} for ${to}`);
//       } else {
//         console.log(`Call answer failed: ${to} not found`);
//       }
//     });

//     socket.on("rejectCall", ({ to }) => {
//       if (to === receiverId) {
//         clearTimeout(callTimeout);
//         io.to(socket.id).emit("callRejected");
//         io.to(receiverSocketId).emit("callRejectedByRemote");
//         console.log(`Call rejected by ${userId} for ${to}`);
//       } else {
//         console.log(`Call rejection failed: ${to} not found`);
//       }
//     });
//   });

//   socket.on("iceCandidate", ({ to, candidate }) => {
//     const receiverSocketId = getReceiverSocketId(to);
//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit("iceCandidate", { candidate });
//       console.log(`ICE candidate sent from ${userId} to ${to}`);
//     } else {
//       console.log(`ICE candidate sending failed: ${to} not found`);
//     }
//   });

//   socket.on("endCall", ({ to }) => {
//     const receiverSocketId = getReceiverSocketId(to);
//     if (receiverSocketId) {
//       userCallStatus[userId as string] = false;
//       userCallStatus[to] = false;
//       io.to(receiverSocketId).emit("callEnded");
//       console.log(`Call ended by ${userId} for ${to}`);
//     } else {
//       console.log(`Call ending failed: ${to} not found`);
//     }
//   });
// });

// export { app, io, server, getReceiverSocketId };

