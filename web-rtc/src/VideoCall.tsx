import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

// Const
import { CLOSE_CODE } from "./const";

// Hook
import useClose from "./hook/useClose";
import useSendToServer from "./hook/useSendToServer";

// Type
import { Data } from "./type";

const VideoCall = () => {
  // 소켓 관련
  const socketRef = useRef<WebSocket>();
  const { sendToServer } = useSendToServer()

  // 연결 해제 관련
  const { closeAll } = useClose();

  // 자신의 비디오
  const myVideoRef = useRef<HTMLVideoElement>(null);

  // 다른사람의 비디오
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // peerConnection
  const pcRef = useRef<RTCPeerConnection>();

  // 저는 특정 화면에서 방으로 진입시에 해당 방의 방번호를 url parameter로 전달해주었습니다.
  const { roomName = 'roomName' } = useParams();

  const getMedia = useCallback(async (ws: WebSocket | undefined, pc: RTCPeerConnection | undefined) => {
    try {
      // 자신이 원하는 자신의 스트림정보
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      if (!(ws && pc)) return;

      // 스트림을 peerConnection에 등록
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // iceCandidate 이벤트
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const data = { type: 'candidate', roomName, data: e.candidate };
          console.log("recv candidate", data);

          sendToServer(ws, data);
        }
      };

      // 구 addStream 현 track 이벤트 
      pc.ontrack = (e) => {
        console.log('track')
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };
    } catch (e) {
      console.error(e);
    }
  }, [sendToServer]);

  const createOffer = useCallback(async (ws: WebSocket | undefined, pc: RTCPeerConnection | undefined) => {
    console.log("create Offer");

    if (!(ws && pc)) return;

    try {
      // offer 생성
      const sdp = await pc.createOffer();

      // 자신의 sdp로 LocalDescription 설정
      await pc.setLocalDescription(sdp);

      // offer 전달
      // const data = { roomName, ...sdp }; // 안되면 아래 주석으로 실행
      const data = { type: sdp.type, roomName, data: sdp.sdp };
      console.log("sent the offer", data);

      sendToServer(ws, data);

    } catch (e) {
      console.error(e);
    }
  }, [sendToServer]);

  const createAnswer = useCallback(async (ws: WebSocket | undefined, pc: RTCPeerConnection | undefined, sdp: RTCSessionDescription) => {
    // sdp : PeerA에게서 전달받은 offer
    console.log("createAnswer");

    if (!(ws && pc)) return;

    try {
      // PeerA가 전달해준 offer를 RemoteDescription에 등록해 줍시다.
      await pc.setRemoteDescription(sdp);

      // answer생성해주고
      const answerSdp = await pc.createAnswer();

      // answer를 LocalDescription에 등록해 줍니다. (PeerB 기준)
      await pc.setLocalDescription(answerSdp);

      // const data = { roomName, ...answerSdp }; // 안되면 아래 주석으로 실행
      const data = { type: answerSdp.type, roomName, data: answerSdp.sdp };
      console.log("sent the answer", data);

      sendToServer(ws, data);

    } catch (e) {
      console.error(e);
    }
  }, [sendToServer]);

  useEffect(() => {
    console.log('start')

    // 소켓 연결
    // socketRef.current = new WebSocket('ws://localhost/socket');
    socketRef.current = new WebSocket('ws://bitchat-server.lookthis.co.kr/socket');
    const ws = socketRef.current;

    // peerConnection 생성
    // iceServers는 stun sever설정이며 google의 public stun server를 사용하였습니다.
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });
    const pc = pcRef.current;

    // 서버 메세지 수신 시
    ws.onmessage = async (event) => {
      console.log(event.data);
      const { type, data:receiveData }: Data = JSON.parse(event.data);

      console.log(type, receiveData);
      
      if(!type && !receiveData) return;

      switch (type) {
        // 기존 유저가 있고, 새로운 유저가 들어왔다면 오퍼생성
        case 'all_users':
          console.log("all_users");
          if ('allUsers' in receiveData && receiveData.allUsers.length > 0) createOffer(ws, pc);

          break;
        case 'getOffer':
          console.log("recv Offer");
          if ('sdp' in receiveData) createAnswer(ws, pc, receiveData.sdp as RTCSessionDescription);

          break;
        case 'getAnswer':
          console.log("recv Answer");
          if ('sdp' in receiveData) await pc.setRemoteDescription(receiveData.sdp as RTCSessionDescription);

          break;
        case 'getCandidate':
          console.log("recv Offer");
          if ('candidate' in receiveData) await pc.addIceCandidate(receiveData.candidate as RTCIceCandidate);

          break;
        case 'room_full':
          console.log("room_full");

          break;
        default:
          break;
      }
    };

    // 소켓 연결 완료 시
    ws.onopen = async (event) => {
      console.log('Connected Success')

      await getMedia(ws, pc);

      const data = {
        type: "join_room",
        roomName
      };
      
      // 해당 방의 roomName을 서버에 전달
      console.log("join_room");
      sendToServer(ws, data);
    };

    // 언마운트시 연결 종료
    return () => {
      closeAll(CLOSE_CODE.RERENDER, ws, pc);
    };
  }, [sendToServer, closeAll]);

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
