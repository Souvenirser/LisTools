const KiB=1024,MiB=1024**2;
const profiles={light:[[100*KiB,2],[MiB,2],[5*MiB,1]],standard:[[100*KiB,2],[MiB,3],[10*MiB,3],[25*MiB,2]]};
export function speedConfig(profile='light') {
  if (!Object.hasOwn(profiles,profile)) throw new RangeError('Unknown speed test profile');
  return {
    autoStart:false,downloadApiUrl:'https://speed.cloudflare.com/__down',uploadApiUrl:'https://speed.cloudflare.com/__up',
    logMeasurementApiUrl:null,logAimApiUrl:null,includeCredentials:false,authorizationToken:null,authorizationEnabled:false,sessionId:undefined,
    measureDownloadLoadedLatency:true,measureUploadLoadedLatency:true,bandwidthAbortRequestDuration:15000,
    measurements:[{type:'latency',numPackets:20},...['download','upload'].flatMap(type=>profiles[profile].map(([bytes,count])=>({type,bytes,count}))) ]
  };
}
export const plannedBytes=profile=>speedConfig(profile).measurements.reduce((total,item)=>total+(item.bytes || 0)*(item.count || 0),0);
const finite=value=>typeof value==='number' && Number.isFinite(value) && value>=0;
export function readResults(results) {
  const get=name=>results?.[name]?.() || [];
  const summary=results?.getSummary?.() || {};
  const down=get('getDownloadBandwidthPoints'),up=get('getUploadBandwidthPoints');
  const latency=get('getUnloadedLatencyPoints').filter(finite),loadedDown=get('getDownLoadedLatencyPoints').filter(finite),loadedUp=get('getUpLoadedLatencyPoints').filter(finite);
  const measured=(key,points,min=1)=>points.length>=min && finite(summary[key])?summary[key]:null;
  return {
    metrics:{
      downloadBps:measured('download',down.filter(p=>p.duration>=10 && p.bps>0)),uploadBps:measured('upload',up.filter(p=>p.duration>=10 && p.bps>0)),
      latencyMs:measured('latency',latency),jitterMs:measured('jitter',latency,2),
      downloadLatencyMs:measured('downLoadedLatency',loadedDown),downloadJitterMs:measured('downLoadedJitter',loadedDown,2),
      uploadLatencyMs:measured('upLoadedLatency',loadedUp),uploadJitterMs:measured('upLoadedJitter',loadedUp,2)
    },
    completedBytes:[...down,...up].reduce((total,p)=>total+(finite(p.bytes)?p.bytes:0),0),
    samples:{download:down.length,upload:up.length,latency:latency.length,downloadLoaded:loadedDown.length,uploadLoaded:loadedUp.length},
    series:{download:down.filter(p=>finite(p.bps)).map(p=>p.bps),upload:up.filter(p=>finite(p.bps)).map(p=>p.bps)}
  };
}
