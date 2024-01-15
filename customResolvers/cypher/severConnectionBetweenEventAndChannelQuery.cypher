MATCH (e:Event {id: $eventId})<-[r:POSTED_IN_CHANNEL]-(ec:EventChannel {eventId: $eventId, channelUniqueName: $channelUniqueName})
DELETE r