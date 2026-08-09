import { Composition, registerRoot } from "remotion";
import { VideoClipComposition } from "./VideoClipComposition";
import React from "react";

export const Root = () => {

    return (
        <>
            <Composition
                id="VideoClip"
                component={VideoClipComposition}
                durationInFrames={1800} // maximum 60 seconds at 30 fps
                fps={30}
                width={1080}
                height={1920}
                defaultProps={{
                    videoUrl: "",
                    startSec: 0,
                    endSec: 10,
                    subwords: [],
                    stylePreset: "modern-box",
                    captionSettings: {},
                    isPreCut: false
                }}
            />
        </>
    );

};

registerRoot(Root);
