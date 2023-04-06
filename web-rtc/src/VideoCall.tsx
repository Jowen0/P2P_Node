import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";

const VideoCall = () => {
  // 소켓정보를 담을 Ref
  const socketRef = useRef<Socket>();
  // 자신의 비디오
  const myVideoRef = useRef<HTMLVideoElement>(null);
  // 다른사람의 비디오
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // peerConnection
  const pcRef = useRef<RTCPeerConnection>();

  // 저는 특정 화면에서 방으로 진입시에 해당 방의 방번호를 url parameter로 전달해주었습니다.
  const { roomName } = useParams();

  const getMedia = async () => {
    try {
      // 자신이 원하는 자신의 스트림정보
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }

      if (!(pcRef.current && socketRef.current)) {
        return;
      }

      // 스트림을 peerConnection에 등록
      stream.getTracks().forEach((track) => {
        if (!pcRef.current) {
          return;
        }
        
        pcRef.current.addTrack(track, stream);
      });

      // iceCandidate 이벤트
      pcRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          if (!socketRef.current) {
            return;
          }
          console.log("recv candidate");
          socketRef.current.emit("candidate", e.candidate, roomName);
        }
      };

      // 구 addStream 현 track 이벤트 
      pcRef.current.ontrack = (e) => {
        console.log('여기')
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };
    } catch (e) {
      console.error(e);
    }
  };

  const createOffer = async () => {
    console.log("create Offer");
    if (!(pcRef.current && socketRef.current)) {
      return;
    }

    try {
      // offer 생성
      const sdp = await pcRef.current.createOffer();
      // 자신의 sdp로 LocalDescription 설정
      await pcRef.current.setLocalDescription(sdp);
      console.log("sent the offer");
      // offer 전달
      socketRef.current.emit("offer", sdp, roomName);
    } catch (e) {
      console.error(e);
    }
  };

  const createAnswer = async (sdp: RTCSessionDescription) => {
    // sdp : PeerA에게서 전달받은 offer

    console.log("createAnswer");
    if (!(pcRef.current && socketRef.current)) {
      return;
    }

    try {
      // PeerA가 전달해준 offer를 RemoteDescription에 등록해 줍시다.
      await pcRef.current.setRemoteDescription(sdp);

      // answer생성해주고
      const answerSdp = await pcRef.current.createAnswer();

      // answer를 LocalDescription에 등록해 줍니다. (PeerB 기준)
      await pcRef.current.setLocalDescription(answerSdp);

      console.log("sent the answer");
      socketRef.current.emit("answer", answerSdp, roomName);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    console.log('start')
    // 소켓 연결
    socketRef.current = io("localhost:8080");

    // peerConnection 생성
    // iceServers는 stun sever설정이며 google의 public stun server를 사용하였습니다.
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    // 기존 유저가 있고, 새로운 유저가 들어왔다면 오퍼생성
    socketRef.current.on("all_users", (allUsers: Array<{ id: string }>) => {
      console.log("all_users");
      if (allUsers.length > 0) {
        createOffer();
      }
    });

    // offer를 전달받은 PeerB만 해당됩니다
    // offer를 들고 만들어둔 answer 함수 실행
    socketRef.current.on("getOffer", (sdp: RTCSessionDescription) => {
      console.log("recv Offer");
      createAnswer(sdp);
    });

    // answer를 전달받을 PeerA만 해당됩니다.
    // answer를 전달받아 PeerA의 RemoteDescription에 등록
    socketRef.current.on("getAnswer", async (sdp: RTCSessionDescription) => {
      console.log("recv Answer");
      if (!pcRef.current) {
        return;
      }
      await pcRef.current.setRemoteDescription(sdp);
    });

    // 서로의 candidate를 전달받아 등록
    socketRef.current.on("getCandidate", async (candidate: RTCIceCandidate) => {
      if (!pcRef.current) {
        return;
      }

      await pcRef.current.addIceCandidate(candidate);
    });

    const test = async (socketRef: any) => {
      
      await getMedia();
      
      // 마운트시 해당 방의 roomName을 서버에 전달
      socketRef.current.emit("join_room", {
        room: roomName,
      });
    }

    test(socketRef)

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  return (
    <div>
      <video
        id="myvideo"
        style={{
          width: 240,
          height: 240,
          backgroundColor: "black",
        }}
        ref={myVideoRef}
        autoPlay
      />
      <br />
      <video
        id="remotevideo"
        style={{
          width: 240,
          height: 240,
          backgroundColor: "black",
        }}
        ref={remoteVideoRef}
        autoPlay
      />
    </div>
  );
};

export default VideoCall;