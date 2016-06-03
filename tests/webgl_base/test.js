var canvas;
var textCanvas;
var gl;
var textContext;
var mvMatrix;
var quadShader;
var textShader;
var perspectiveMatrix;

var textQuads = [];

var textContextHelper = {
    nextStart: 0,
    nextLineStart: 0,
    currentLineHeight: 0,
    texture: null
};

var nodes = [{
    color: [1.0, 0.0, 0.0, 1],
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
    size: 200,
    position: {
        x: 500.0,
        y: 0.0,
        z: 0.0
    },
    name: 'Bobby',
    font: 'Arial',
    fontSize: '20px'
}, {
    color: [1.0, 0.0, 1.0, 1],
    size: 150,
    position: {
        x: 200.0,
        y: 200.0,
        z: 0.0
    },
    name: 'Bobbette',
    font: 'Arial',
    fontSize: '20px'
}];

var megaPositionBuffer = null;
var megaColorBuffer = null;
var megaIndexBuffer = null;

//
// start
//
// Called when the canvas is created to get the ball rolling.
// Figuratively, that is. There's nothing moving in this demo.
//
function start() {
    canvas = document.getElementById("glcanvas");
    textCanvas = document.getElementById('textCanvas');

    initNodes();

    initWebGL();      // Initialize the GL context
    initTextContext();

    // Only continue if WebGL is available and working

    if (gl) {
        gl.clearColor(0.2, 0.2, 0.2, 1.0);  // Clear to gray, fully opaque
        gl.clearDepth(1.0);                 // Clear everything
        gl.enable(gl.DEPTH_TEST);           // Enable depth testing
        gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

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
    var nbNodes = 1000;
    for (var i = 0; i < nbNodes; i++) {
        nodes.push({
            color: [Math.random(), Math.random(), Math.random(), 1],
            size: 1 + Math.random() * 100,
            position: {
                x: (Math.random() - 0.5) * 500,
                y: (Math.random() - 0.5) * 500,
                z: 0.0
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
function initWebGL() {
    gl = null;

    try {
        gl = canvas.getContext("webgl");// || canvas.getContext("experimental-webgl");
    }
    catch(e) {
    }

    // If we don't have a GL context, give up now

    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
    }
}

function initTextContext() {
    //var textCanvas = document.createElement("canvas");

    try {
        textContext = textCanvas.getContext("2d")
    } catch (e) {
    }

    if (!textContext) {
        alert('Failed to load HTML5 canvas');
    }
}

function makeTextCanvas(text, width, height) {
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

function generateTextureFromCanvas(_canvas) {
    var textWidth  = _canvas.width;
    var textHeight = _canvas.height;
    var textTex = gl.createTexture();
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
function initBuffers() {

    // Create a buffer for the nodes
    var buffers = createMegaBuffer(nodes);
    megaPositionBuffer = buffers.position;
    megaColorBuffer = buffers.color;
    megaIndexBuffer = buffers.index;
}

function createBuffer (node) {
    var buffer = gl.createBuffer();

    // Select the squareVerticesBuffer as the one to apply vertex
    // operations to from here out.

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // Now create an array of vertices for the square. Note that the Z
    // coordinate is always 0 here.
    var size = 0.5 * node.size;
    var vertices = [
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
    var allVertices = new Array(nodes.length * 12);
    var allColors = new Array(nodes.length * 16);
    var allIndices = new Array(nodes.length * 6);
    var indexVertices = 0;
    var indexColors = 0;
    var indexIndices = 0;
    var pushedVertex = 0;
    for (var node of nodes) {
        var size = 0.5 * node.size;
        allVertices[indexVertices] = size + node.position.x;
        allVertices[indexVertices+1] = size + node.position.y;
        allVertices[indexVertices+2] = 0.0;
        allVertices[indexVertices+3] = -size + node.position.x;
        allVertices[indexVertices+4] = size + node.position.y;
        allVertices[indexVertices+5] = 0.0;
        allVertices[indexVertices+6] = -size + node.position.x;
        allVertices[indexVertices+7] = -size + node.position.y;
        allVertices[indexVertices+8] = 0.0;
        allVertices[indexVertices+9] = size + node.position.x;
        allVertices[indexVertices+10] = -size + node.position.y;
        allVertices[indexVertices+11] = 0.0;
        indexVertices = indexVertices + 12;

        for(var i = 0; i < 4; i++) {
            allColors[indexColors + i * 4] = node.color[0];
            allColors[indexColors + i * 4 + 1] = node.color[1];
            allColors[indexColors + i * 4 + 2] = node.color[2];
            allColors[indexColors + i * 4 + 3] = node.color[3];
        }
        indexColors = indexColors + 16;

        allIndices[indexIndices] = pushedVertex + 0;
        allIndices[indexIndices+1] = pushedVertex + 1;
        allIndices[indexIndices+2] = pushedVertex + 2;
        allIndices[indexIndices+3] = pushedVertex + 2;
        allIndices[indexIndices+4] = pushedVertex + 3;
        allIndices[indexIndices+5] = pushedVertex + 0;
        indexIndices = indexIndices + 6;

        pushedVertex = pushedVertex + 4;
    }


    // Now pass the list of vertices into WebGL to build the shape. We
    // do this by creating a Float32Array from the JavaScript array,
    // then use it to fill the current vertex buffer.
    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(allVertices), gl.STATIC_DRAW);

    var colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(allColors), gl.STATIC_DRAW);

    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(allIndices), gl.STATIC_DRAW);

    return {position: positionBuffer, color: colorBuffer, index: indexBuffer};
}

function generateTextQuadsBuffers () {

    var texture = drawTextForNodes(nodes, textContext);
    textContextHelper.texture = texture.texture;

    var vertices = new Array(12);
    var texCoords = new Array(8);
    var indices = new Array(6);
    for (var node of nodes) {
        //var _textCanvas = makeTextCanvas(node.name, node.size, node.size);
        //var texture = generateTextureFromCanvas(_textCanvas);
        var textureInfo = node.texttureInfo;

        var size = 0.5 * node.size;
        var halfWidth = textureInfo.w / 2;
        var halfHeight = textureInfo.h / 2;
        vertices[0] = node.position.x + halfWidth;
        vertices[1] = node.position.y + halfHeight;
        vertices[2] = 0.0;
        vertices[3] = node.position.x - halfWidth;
        vertices[4] = node.position.y + halfHeight;
        vertices[5] = 0.0;
        vertices[6] = node.position.x - halfWidth;
        vertices[7] = node.position.y - halfHeight;
        vertices[8] = 0.0;
        vertices[9] = node.position.x + halfWidth;
        vertices[10] = node.position.y - halfHeight;
        vertices[11] = 0.0;

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

        var positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        var textureBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        var indexBuffer = gl.createBuffer();
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
function drawScene() {
    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Establish the perspective with which we want to view the
    // scene. Our field of view is 45 degrees, with a width/height
    // ratio of 640:480, and we only want to see objects between 0.1 units
    // and 100 units away from the camera.
    var width = 1280;
    var height = 720;
    perspectiveMatrix = makeOrtho(-width/2.0, width/2.0, -height/2.0, height/2.0, 0, 1);

    loadIdentity();

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
    for (var textQuad of textQuads) {

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

function drawText() {
    textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);

    textContext.save();

    textContext.translate(textCanvas.width/2, textCanvas.height/2);
    for (var node of nodes) {
        textContext.textAlign = 'center';
        textContext.font  = node.fontSize + ' ' + node.font;
        textContext.fillText(node.name, node.position.x, node.position.y);
    }

    textContext.restore();
}

function drawTextForNodes(nodes, _context) {
    _context.clearRect(0, 0, textCanvas.width, textCanvas.height);
    _context.save();

    for (var node of nodes) {
        node.texttureInfo = pushTextOnContext(_context, node.name, {textAlign: "center", font: node.font, fontSize: node.fontSize});
    }

    _context.restore();

    return generateTextureFromCanvas(textCanvas);
}

function drawTextOnContext(_context, text, x, y, options) {
    _context.textAlign = options.textAlign;
    _context.font  = options.fontSize + ' ' + options.font;
    _context.fillText(text, x, y);
}

function pushTextOnContext(_context, text, options) {
    _context.textAlign = options.textAlign;
    _context.font  = options.fontSize + ' ' + options.font;
    var textMetrics = _context.measureText(text); // TextMetrics object
    var textWidth = textMetrics.width;
    var textHeight = textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent;

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

    var xStart = textContextHelper.nextStart;
    var yStart = textContextHelper.nextLineStart;

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
function initShaders() {
    quadShader = initShader("shader-vs", "shader-fs", null, ['aVertexPosition', 'aVertexColor']);
    textShader = initShader("shader-text-vs", "shader-text-fs", null, ['aVertexPosition', 'aVertexTexCoord']);
}

function initShader(vertexShader, fragmentShader, uniforms, attributes) {
    uniforms = uniforms || [];
    attributes = attributes || [];

    var fragmentShaderProg = getShader(gl, fragmentShader);
    var vertexShaderProg = getShader(gl, vertexShader);

    // Create the shader program

    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShaderProg);
    gl.attachShader(shaderProgram, fragmentShaderProg);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program.");
    }

    gl.useProgram(shaderProgram);

    var uniformLocations = {};
    // for (var uniform of uniforms) {
    //
    // }

    var attributeLocations = {};
    for (var attribute of attributes) {
        var attributeLocation = gl.getAttribLocation(shaderProgram, attribute);
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
function getShader(gl, id) {
    var shaderScript = document.getElementById(id);

    // Didn't find an element with the specified ID; abort.

    if (!shaderScript) {
        return null;
    }

    // Walk through the source element's children, building the
    // shader source string.

    var theSource = "";
    var currentChild = shaderScript.firstChild;

    while(currentChild) {
        if (currentChild.nodeType == 3) {
            theSource += currentChild.textContent;
        }

        currentChild = currentChild.nextSibling;
    }

    // Now figure out what type of shader script we have,
    // based on its MIME type.

    var shader;

    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
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

function loadIdentity() {
    mvMatrix = Matrix.I(4);
}

function multMatrix(m) {
    mvMatrix = mvMatrix.x(m);
}

function mvTranslate(v) {
    multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}

function setMatrixUniforms(shaderProgram) {
    var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

    var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));
}