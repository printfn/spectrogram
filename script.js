let paused = true;
let ctx = null;
let canvas = null;
const spectrogramScale = chroma.scale(['black','purple','red','yellow','white']).correctLightness();

async function togglePause() {
    if (paused) {
        paused = false;
        document.getElementById('pauseButton').value = '||';
        // start spectrogram
        await getMicrophone();
    } else {
        paused = true;
        document.getElementById('pauseButton').value = '>';
        // stop spectrogram
    }
}

async function getMicrophone() {
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        /* use the stream */
        processStream(stream);
    } catch (err) {
        alert('Error capturing audio. Make sure you have allowed microphone access, or try using a different browser.');
    }
}

function processMicrophoneBuffer(event) {
    let microphone_output_buffer = event.inputBuffer.getChannelData(0); // just mono - 1 channel for now
    // microphone_output_buffer  <-- this buffer contains current gulp of data size BUFF_SIZE

    //show_some_data(microphone_output_buffer, 5, "from getChannelData");
}

async function processStream(stream) {
    const BUFF_SIZE = 16384;

    let audioContext = new AudioContext();
    let gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);

    let microphoneStream = audioContext.createMediaStreamSource(stream);

    let scriptProcessorNode = audioContext.createScriptProcessor(BUFF_SIZE, 1, 1);
    scriptProcessorNode.onaudioprocess = processMicrophoneBuffer;

    microphoneStream.connect(scriptProcessorNode);

    let scriptProcessorFFTNode = audioContext.createScriptProcessor(2048, 1, 1);
    scriptProcessorFFTNode.connect(gainNode);

    analyserNode = audioContext.createAnalyser();
    analyserNode.smoothingTimeConstant = 0;
    analyserNode.fftSize = 2048;

    microphoneStream.connect(analyserNode);

    analyserNode.connect(scriptProcessorFFTNode);

    scriptProcessorFFTNode.onaudioprocess = () => {
        // get the average for the first channel
        let array = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(array);

        // draw the spectrogram
        if (microphoneStream.playbackState == microphoneStream.PLAYING_STATE) {
            spectrogramTick(array);
        }
    };
}

function colourMap(x) {
    return spectrogramScale(x).rgb();
}

function spectrogramTick(array) {
    let imageData = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
    ctx.putImageData(imageData, 0, 0);
    let imageDataArray = new Uint8ClampedArray(canvas.height * 4);
    for (let i = 0; i < canvas.height; ++i) {
        let sample = array[Math.floor((1 - i / canvas.height) * array.length)];
        let mappedColour = colourMap(sample / 255);
        if (Math.random() * 5000 < 1) {
            console.log(`${sample} => ${mappedColour}`);
        }
        imageDataArray[4 * i] = mappedColour[0];
        imageDataArray[4 * i + 1] = mappedColour[1];
        imageDataArray[4 * i + 2] = mappedColour[2];
        imageDataArray[4 * i + 3] = 255;
    }
    let newColumn = new ImageData(imageDataArray, 1, canvas.height);
    ctx.putImageData(newColumn, canvas.width - 1, 0);
}

window.onload = () => {
    setupPitchTable();
    document.getElementById('pauseButton').addEventListener('click', togglePause);

    canvas = document.getElementById('spectrogramCanvas');
    ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

// function onTick() {
//     window.requestAnimationFrame(onTick);
// }

function setupPitchTable() {
    let table = '';
    for (let i = 0; i < 12; ++i) {
        table += '<tr>';
        for (let j = 0; j < 9; ++j) {
            let note = '';
            switch (i) {
                case 0: note = 'C'; break;
                case 1: note = 'C\u266F'; break; // flat would be \u266D
                case 2: note = 'D'; break;
                case 3: note = 'D\u266F'; break;
                case 4: note = 'E'; break;
                case 5: note = 'F'; break;
                case 6: note = 'F\u266F'; break;
                case 7: note = 'G'; break;
                case 8: note = 'G\u266F'; break;
                case 9: note = 'A'; break;
                case 10: note = 'B\u266F'; break;
                case 11: note = 'B'; break;
            }
            let pitch = 440 * Math.pow(2, (j - 5) + (i + 3) / 12);
            let pitchString = pitch.toFixed(2);
            table += `<td>${note}<sub>${j}</sub>:&nbsp;<span class="right">${pitchString}</span></td>`;
        }
        table += '</tr>';
    }
    document.getElementById('pitch-table').innerHTML = table;
}
