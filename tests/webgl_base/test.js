let canvas;
let textCanvas;
let gl;
let textContext;
let mvMatrix;
let quadShader;
let textShader;
let perspectiveMatrix;

let textQuads = [];

let textContextHelper = {
    nextStart: 0,
    nextLineStart: 0,
    currentLineHeight: 0,
    texture: null
};

let cameraOptions = {
    targetElement: null,
    isInsideView: false,
    translateMatrix: [0, 0, 0],
    zoom: 1.0,
    extend: [0, 0, 0],
    originalExtend: [0, 0, 0],
    isDragging: false,
    lastMousePosition: {
        x: 0,
        y: 0
    },
    lastGlobalMousePosition: {
        x: 0,
        y: 0
    },
    cameraViewPosition: {
        x: 0,
        y: 0
    }
};

let nodes = [{
    color: [1.0, 0.0, 0.0, 1],
    state: {
        normal: {
            color: [1.0, 0.0, 0.0, 1]
        },
        highlight: {
            color: [1.0, 0.2, 0.2, 1]
        }
    },
    size: 100,
    position: {
        x: 0.0,
        y: 0.0,
        z: 0.0
    },
    name: 'Bob',
    font: 'Arial',
    fontSize: '20px'
}, {
    color: [1.0, 1.0, 0.0, 1],
    state: {
        normal: {
            color: [1.0, 1.0, 0.0, 1]
        },
        highlight: {
            color: [1.0, 1.0, 0.2, 1]
        }
    },
    size: 200,
    position: {
        x: 500.0,
        y: 0.0,
        z: 0
    },
    name: 'Bobby',
    font: 'Arial',
    fontSize: '20px'
}, {
    color: [1.0, 0.0, 1.0, 1],
    state: {
        normal: {
            color: [1.0, 0.0, 1.0, 1]
        },
        highlight: {
            color: [1.0, 0.2, 1.0, 1]
        }
    },
    size: 150,
    position: {
        x: 500.0,
        y: 150.0,
        z: 1
    },
    name: 'Bobbette',
    font: 'Arial',
    fontSize: '20px'
}];

let megaPositionBuffer = null;
let megaColorBuffer = null;
let megaIndexBuffer = null;

function start () {
    canvas = document.getElementById("glcanvas");
    textCanvas = document.getElementById('textCanvas');

    initNodes();

    initWebGL();      // Initialize the GL context
    initWebGLMouseHandlers(canvas);
    initTextContext();

    // Only continue if WebGL is available and working

    if (gl) {
        gl.clearColor(0.2, 0.2, 0.2, 1.0);  // Clear to gray, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Initialize the shaders; this is where all the lighting for the
        // vertices and so forth is established.

        initShaders();

        // Here's where we call the routine that builds all the objects
        // we'll be drawing.

        initBuffers();

        generateTextQuadsBuffers();

        // Set up to draw the scene periodically.
        requestAnimationFrame(drawScene);
    }
}

function initNodes () {
    let nbNodes = 2000;
    for (let i = 0; i < nbNodes; i++) {
        let color = [Math.random(), Math.random(), Math.random(), 1];
        let highlightColor = [color[0] * 1.2, color[1] * 1.2, color[2] * 1.2, 1];
        nodes.push({
            color: color,
            state: {
                normal: {
                    color: color
                },
                highlight: {
                    color: highlightColor
                }
            },
            size: 1 + Math.random() * 100,
            position: {
                x: (Math.random() * 2 - 1) * 500,
                y: (Math.random() * 2 - 1) * 500,
                z: Math.random()
            },
            font: 'Arial',
            fontSize: (5 + Math.random() * 10).toFixed(0).toString() + 'px',
            name: (1 + Math.random() * 100).toFixed(0).toString()
        })
    }
}

//
// initWebGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initWebGL () {
    gl = null;

    try {
        gl = canvas.getContext("webgl");// || canvas.getContext("experimental-webgl");
        cameraOptions.extend = [canvas.width / 2, canvas.height / 2, 0];
        cameraOptions.originalExtend = [canvas.width / 2, canvas.height / 2, 0];
    }
    catch(e) {
    }

    // If we don't have a GL context, give up now

    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
    }
}

function initWebGLMouseHandlers (domElement) {
    window.document.addEventListener('mousemove', onMouseMove, true);
    domElement.addEventListener('mousedown', onMouseDown, true);
    domElement.addEventListener('mouseout', onMouseOut, true);
    domElement.addEventListener('mousewheel', onMouseWheel, true);
    window.addEventListener('mouseup', onMouseUp, true);
    cameraOptions.targetElement = domElement;
}

function onMouseMove (event) {
    cameraOptions.isInsideView = event.toElement === cameraOptions.targetElement;

    if (cameraOptions.isDragging) {
        let translation = [event.x - cameraOptions.lastGlobalMousePosition.x, cameraOptions.lastGlobalMousePosition.y - event.y, 0];
        translation = [translation[0] * cameraOptions.zoom, translation[1] * cameraOptions.zoom, 0];
        cameraOptions.translateMatrix = [cameraOptions.translateMatrix[0] + translation[0], cameraOptions.translateMatrix[1] + translation[1], cameraOptions.translateMatrix[2] + translation[2]];

        cameraOptions.lastMousePosition = {
            x: event.offsetX,
            y: event.offsetY
        };
    }

    cameraOptions.lastGlobalMousePosition = {
        x: event.x,
        y: event.y
    };

    if (cameraOptions.isInsideView) {
        let offsetFromCenter = {
                x: event.offsetX - canvas.width / 2,
                y: canvas.height / 2 - event.offsetY
        };
        offsetFromCenter.x = offsetFromCenter.x * cameraOptions.zoom;
        offsetFromCenter.y = offsetFromCenter.y * cameraOptions.zoom;
        cameraOptions.cameraViewPosition = {
            x: -cameraOptions.translateMatrix[0] + offsetFromCenter.x,
            y: -cameraOptions.translateMatrix[1] + offsetFromCenter.y
        };
    }
}

function onMouseDown (event) {
    console.log("mouse down");

    cameraOptions.lastMousePosition = {
        x: event.offsetX,
        y: event.offsetY
    };

    cameraOptions.isDragging = true;
    cameraOptions.isInsideView = true;
}

function onMouseOut (event) {

}

function onMouseUp (event) {
    cameraOptions.isDragging = false;
}

function onMouseWheel (event) {
    let delta = Math.max(-1, Math.min(1, event.wheelDelta));

    if (delta > 0) {
        cameraOptions.zoom -= 0.1;
    }
    if (delta < 0) {
        cameraOptions.zoom += 0.1;
    }

    cameraOptions.zoom = Math.max(0, Math.min(2, cameraOptions.zoom));

    cameraOptions.extend = [cameraOptions.originalExtend[0] * cameraOptions.zoom, cameraOptions.originalExtend[1] * cameraOptions.zoom, cameraOptions.originalExtend[2] * cameraOptions.zoom]

    event.stopPropagation();
    event.preventDefault();
}

function initTextContext () {
    //let textCanvas = document.createElement("canvas");

    try {
        textContext = textCanvas.getContext("2d")
    } catch (e) {
    }

    if (!textContext) {
        alert('Failed to load HTML5 canvas');
    }
}

function makeTextCanvas (text, width, height) {
    textContext.canvas.width  = width;
    textContext.canvas.height = height;
    textContext.font = "20px monospace";
    textContext.textAlign = "center";
    textContext.textBaseline = "middle";
    textContext.fillStyle = "black";
    textContext.clearRect(0, 0, textContext.canvas.width, textContext.canvas.height);
    textContext.fillText(text, width / 2, height / 2);
    return textContext.canvas;
}

function generateTextureFromCanvas (_canvas) {
    let textWidth  = _canvas.width;
    let textHeight = _canvas.height;
    let textTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, _canvas);
    // make sure we can render it even if it's not a power of 2
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return {
        texture: textTex,
        width: textWidth,
        height: textHeight
    };
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just have
// one object -- a simple two-dimensional square.
//
function initBuffers () {

    // Create a buffer for the nodes
    let buffers = createMegaBuffer(nodes);
    megaPositionBuffer = buffers.position;
    megaColorBuffer = buffers.color;
    megaIndexBuffer = buffers.index;
}

function createBuffer (node) {
    let buffer = gl.createBuffer();

    // Select the squareVerticesBuffer as the one to apply vertex
    // operations to from here out.

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // Now create an array of vertices for the square. Note that the Z
    // coordinate is always 0 here.
    let size = 0.5 * node.size;
    let vertices = [
        size,  size,  0.0,
        -size, size,  0.0,
        size,  -size, 0.0,
        -size, -size, 0.0
    ];

    // Now pass the list of vertices into WebGL to build the shape. We
    // do this by creating a Float32Array from the JavaScript array,
    // then use it to fill the current vertex buffer.

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    return buffer;
}

function createMegaBuffer (nodes) {
    // Now create an array of vertices for all nodes. Note that the Z
    // coordinate is always 0 here.
    let allVertices = new Array(nodes.length * 12);
    let allColors = new Array(nodes.length * 16);
    let allIndices = new Array(nodes.length * 6);
    let indexVertices = 0;
    let indexColors = 0;
    let indexIndices = 0;
    let pushedVertex = 0;
    for (let node of nodes) {
        let size = 0.5 * node.size;
        allVertices[indexVertices] = size + node.position.x;
        allVertices[indexVertices+1] = size + node.position.y;
        allVertices[indexVertices+2] = node.position.z;
        allVertices[indexVertices+3] = -size + node.position.x;
        allVertices[indexVertices+4] = size + node.position.y;
        allVertices[indexVertices+5] = node.position.z;
        allVertices[indexVertices+6] = -size + node.position.x;
        allVertices[indexVertices+7] = -size + node.position.y;
        allVertices[indexVertices+8] = node.position.z;
        allVertices[indexVertices+9] = size + node.position.x;
        allVertices[indexVertices+10] = -size + node.position.y;
        allVertices[indexVertices+11] = node.position.z;
        indexVertices = indexVertices + 12;

        for(let i = 0; i < 4; i++) {
            allColors[indexColors + i * 4] = node.color[0];
            allColors[indexColors + i * 4 + 1] = node.color[1];
            allColors[indexColors + i * 4 + 2] = node.color[2];
            allColors[indexColors + i * 4 + 3] = node.color[3];
        }
        indexColors = indexColors + 16;

        allIndices[indexIndices] = pushedVertex;
        allIndices[indexIndices+1] = pushedVertex + 1;
        allIndices[indexIndices+2] = pushedVertex + 2;
        allIndices[indexIndices+3] = pushedVertex + 2;
        allIndices[indexIndices+4] = pushedVertex + 3;
        allIndices[indexIndices+5] = pushedVertex;
        indexIndices = indexIndices + 6;

        pushedVertex = pushedVertex + 4;
    }


    // Now pass the list of vertices into WebGL to build the shape. We
    // do this by creating a Float32Array from the JavaScript array,
    // then use it to fill the current vertex buffer.
    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(allVertices), gl.DYNAMIC_DRAW);

    let colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(allColors), gl.DYNAMIC_DRAW);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(allIndices), gl.STATIC_DRAW);

    return {position: positionBuffer, color: colorBuffer, index: indexBuffer};
}

function generateTextQuadsBuffers () {

    let texture = drawTextForNodes(nodes, textContext);
    textContextHelper.texture = texture.texture;

    let vertices = new Array(12);
    let texCoords = new Array(8);
    let indices = new Array(6);
    for (let node of nodes) {
        //let _textCanvas = makeTextCanvas(node.name, node.size, node.size);
        //let texture = generateTextureFromCanvas(_textCanvas);
        let textureInfo = node.texttureInfo;

        let size = 0.5 * node.size;
        let halfWidth = textureInfo.w / 2;
        let halfHeight = textureInfo.h / 2;
        vertices[0] = node.position.x + halfWidth;
        vertices[1] = node.position.y + halfHeight;
        vertices[2] = node.position.z;
        vertices[3] = node.position.x - halfWidth;
        vertices[4] = node.position.y + halfHeight;
        vertices[5] = node.position.z;
        vertices[6] = node.position.x - halfWidth;
        vertices[7] = node.position.y - halfHeight;
        vertices[8] = node.position.z;
        vertices[9] = node.position.x + halfWidth;
        vertices[10] = node.position.y - halfHeight;
        vertices[11] = node.position.z;

        texCoords[0] = textureInfo.sEnd;
        texCoords[1] = textureInfo.tStart;
        texCoords[2] = textureInfo.sStart;
        texCoords[3] = textureInfo.tStart;
        texCoords[4] = textureInfo.sStart;
        texCoords[5] = textureInfo.tEnd;
        texCoords[6] = textureInfo.sEnd;
        texCoords[7] = textureInfo.tEnd;

        indices[0] = 0;
        indices[1] = 1;
        indices[2] = 2;
        indices[3] = 2;
        indices[4] = 3;
        indices[5] = 0;

        let positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);

        let textureBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        let indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        textQuads.push({
            position: positionBuffer,
            texCoords: textureBuffer,
            index: indexBuffer
        });
    }
}

//
// drawScene
//
// Draw the scene.
//
function drawScene () {
    // Update the state
    update();

    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Establish the perspective with which we want to view the
    // scene. Our field of view is 45 degrees, with a width/height
    // ratio of 640:480, and we only want to see objects between 0.1 units
    // and 100 units away from the camera.
    perspectiveMatrix = makeOrtho(-cameraOptions.extend[0], cameraOptions.extend[0], -cameraOptions.extend[1], cameraOptions.extend[1], 0.0, 1.0);

    loadIdentity();
    mvTranslate(cameraOptions.translateMatrix);

    // Draw the nodes by binding the array buffer to the nodes vertices
    // array, setting attributes, and pushing it to GL.
    gl.useProgram(quadShader.shaderProgram);
    setMatrixUniforms(quadShader.shaderProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, megaPositionBuffer);
    gl.vertexAttribPointer(quadShader.attributeLocations['aVertexPosition'], 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, megaColorBuffer);
    gl.vertexAttribPointer(quadShader.attributeLocations['aVertexColor'], 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, megaIndexBuffer);
    gl.drawElements(gl.TRIANGLES, nodes.length * 6, gl.UNSIGNED_SHORT, 0);

    // draw text buffers
    gl.useProgram(textShader.shaderProgram);
    setMatrixUniforms(textShader.shaderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(textShader.shaderProgram, "texture"), 0);

    gl.bindTexture(gl.TEXTURE_2D, textContextHelper.texture);
    for (let textQuad of textQuads) {

        gl.bindBuffer(gl.ARRAY_BUFFER, textQuad.position);
        gl.vertexAttribPointer(textShader.attributeLocations['aVertexPosition'], 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, textQuad.texCoords);
        gl.vertexAttribPointer(textShader.attributeLocations['aVertexTexCoord'], 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, textQuad.index);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }


    //drawText();

    // request draw frame
    requestAnimationFrame(drawScene);
}

function update () {
    for (let node of nodes) {
        if (isInsideNode(cameraOptions.cameraViewPosition, node)) {
            node.color = node.state.highlight.color;
        } else {
            node.color = node.state.normal.color;
        }

        updateNode(node);
    }
}

function drawText () {
    textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);

    textContext.save();

    textContext.translate(textCanvas.width/2, textCanvas.height/2);
    for (let node of nodes) {
        textContext.textAlign = 'center';
        textContext.font  = node.fontSize + ' ' + node.font;
        textContext.fillText(node.name, node.position.x, node.position.y);
    }

    textContext.restore();
}

function drawTextForNodes (nodes, _context) {
    _context.clearRect(0, 0, textCanvas.width, textCanvas.height);
    _context.save();

    for (let node of nodes) {
        node.texttureInfo = pushTextOnContext(_context, node.name, {textAlign: "center", font: node.font, fontSize: node.fontSize});
    }

    _context.restore();

    return generateTextureFromCanvas(textCanvas);
}

function drawTextOnContext (_context, text, x, y, options) {
    _context.textAlign = options.textAlign;
    _context.font  = options.fontSize + ' ' + options.font;
    _context.fillText(text, x, y);
}

function pushTextOnContext (_context, text, options) {
    _context.textAlign = options.textAlign;
    _context.font  = options.fontSize + ' ' + options.font;
    let textMetrics = _context.measureText(text); // TextMetrics object
    let textWidth = textMetrics.width;
    let textHeight = textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent;

    if (textContextHelper.nextStart + textWidth >= textCanvas.width) {
        textContextHelper.nextStart = 0;
        textContextHelper.nextLineStart += textContextHelper.currentLineHeight;
        textContextHelper.currentLineHeight = 0;
    }

    if (textContextHelper.currentLineHeight < textHeight) {
        textContextHelper.currentLineHeight = textHeight;
    }

    if (textContextHelper.nextLineStart + textContextHelper.currentLineHeight >= textCanvas.height) {
        alert("Text canvas not big enough! You're fucked!");
    }

    let xStart = textContextHelper.nextStart;
    let yStart = textContextHelper.nextLineStart;

    // Lets assume center alignment for now, and fuck the baseline
    _context.fillText(text, textContextHelper.nextStart + (textWidth / 2), textContextHelper.nextLineStart + textMetrics.fontBoundingBoxAscent);

    textContextHelper.nextStart += textWidth;

    return {
        x: xStart,
        y: yStart,
        w: textWidth,
        h: textHeight,
        sStart: xStart / textCanvas.width,
        sEnd: (xStart + textWidth) / textCanvas.width,
        tStart: yStart / textCanvas.height,
        tEnd: (yStart + textHeight) / textCanvas.height
    }
}

//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initShaders () {
    quadShader = initShader("shader-vs", "shader-fs", null, ['aVertexPosition', 'aVertexColor']);
    textShader = initShader("shader-text-vs", "shader-text-fs", null, ['aVertexPosition', 'aVertexTexCoord']);
}

function initShader (vertexShader, fragmentShader, uniforms, attributes) {
    uniforms = uniforms || [];
    attributes = attributes || [];

    let fragmentShaderProg = getShader(gl, fragmentShader);
    let vertexShaderProg = getShader(gl, vertexShader);

    // Create the shader program

    let shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShaderProg);
    gl.attachShader(shaderProgram, fragmentShaderProg);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program.");
    }

    gl.useProgram(shaderProgram);

    let uniformLocations = {};
    // for (let uniform of uniforms) {
    //
    // }

    let attributeLocations = {};
    for (let attribute of attributes) {
        let attributeLocation = gl.getAttribLocation(shaderProgram, attribute);
        gl.enableVertexAttribArray(attributeLocation);
        attributeLocations[attribute] = attributeLocation;
    }

    gl.useProgram(null);

    return {
        shaderProgram: shaderProgram,
        uniformLocations: uniformLocations,
        attributeLocations: attributeLocations
    };
}

//
// getShader
//
// Loads a shader program by scouring the current document,
// looking for a script with the specified ID.
//
function getShader (gl, id) {
    let shaderScript = document.getElementById(id);

    // Didn't find an element with the specified ID; abort.

    if (!shaderScript) {
        return null;
    }

    // Walk through the source element's children, building the
    // shader source string.

    let theSource = "";
    let currentChild = shaderScript.firstChild;

    while(currentChild) {
        if (currentChild.nodeType === 3) {
            theSource += currentChild.textContent;
        }

        currentChild = currentChild.nextSibling;
    }

    // Now figure out what type of shader script we have,
    // based on its MIME type.

    let shader;

    if (shaderScript.type === "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type === "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;  // Unknown shader type
    }

    // Send the source to the shader object

    gl.shaderSource(shader, theSource);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

//
// Matrix utility functions
//

function loadIdentity () {
    mvMatrix = Matrix.I(4);
}

function multMatrix (m) {
    mvMatrix = mvMatrix.x(m);
}

function mvTranslate (v) {
    multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}

function setMatrixUniforms (shaderProgram) {
    let pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

    let mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));
}

function isInsideNode (position, node) {
    let nodeExtend = {
        x: node.size / 2,
        y: node.size / 2
    };
    return position.x <= node.position.x + nodeExtend.x &&
            position.x >= node.position.x - nodeExtend.x &&
            position.y <= node.position.y + nodeExtend.y &&
            position.y >= node.position.y - nodeExtend.y;
}

function updateNode (node) {
    let index = nodes.indexOf(node);
    if (index < 0)
        return;

    let vertices = new Array(12);
    let colors = new Array(16);

    let size = 0.5 * node.size;
    vertices[0] = size + node.position.x;
    vertices[1] = size + node.position.y;
    vertices[2] = node.position.z;
    vertices[3] = -size + node.position.x;
    vertices[4] = size + node.position.y;
    vertices[5] = node.position.z;
    vertices[6] = -size + node.position.x;
    vertices[7] = -size + node.position.y;
    vertices[8] = node.position.z;
    vertices[9] = size + node.position.x;
    vertices[10] = -size + node.position.y;
    vertices[11] = node.position.z;

    for(let i = 0; i < 4; i++) {
        colors[i * 4] = node.color[0];
        colors[i * 4 + 1] = node.color[1];
        colors[i * 4 + 2] = node.color[2];
        colors[i * 4 + 3] = node.color[3];
    }

    let vertexIndex = index * 12;
    let colorIndex = index * 16;

    let sizeOfFloat = 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, megaPositionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, vertexIndex * sizeOfFloat, new Float32Array(vertices));

    gl.bindBuffer(gl.ARRAY_BUFFER, megaColorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, colorIndex * sizeOfFloat, new Float32Array(colors));
}