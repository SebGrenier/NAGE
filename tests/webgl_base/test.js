var canvas;
var gl;
var mvMatrix;
var shaderProgram;
var vertexPositionAttribute;
var vertexColorAttribute;
var perspectiveMatrix;

var nodes = [{
    color: [1.0, 0.0, 0.0, 1],
    size: 100,
    position: {
        x: 0.0,
        y: 0.0,
        z: -1.0
    }
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

    initNodes();

    initWebGL(canvas);      // Initialize the GL context

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

        // Set up to draw the scene periodically.

        setInterval(drawScene, 15);
    }
}

function initNodes () {
    var nbNodes = 10000;
    for (var i = 0; i < nbNodes; i++) {
        nodes.push({
            color: [Math.random(), Math.random(), Math.random(), 1],
            size: 1 + Math.random() * 100,
            position: {
                x: (Math.random() - 0.5) * 500,
                y: (Math.random() - 0.5) * 500,
                z: -1.0
            }
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
        allVertices[indexVertices+2] = 0;
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
    perspectiveMatrix = makeFrustum(-width/2.0, width/2.0, -height/2.0, height/2.0, -1, 1);

    loadIdentity();

    // The -1.0z translation is important!!!!
    mvTranslate([-0.0, 0.0, -1.0]);

    // Draw the nodes by binding the array buffer to the nodes vertices
    // array, setting attributes, and pushing it to GL.
    setMatrixUniforms();

    gl.bindBuffer(gl.ARRAY_BUFFER, megaPositionBuffer);
    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, megaColorBuffer);
    gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, megaIndexBuffer);
    gl.drawElements(gl.TRIANGLES, nodes.length * 6, gl.UNSIGNED_SHORT, 0);
}

//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    // Create the shader program

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program.");
    }

    gl.useProgram(shaderProgram);

    vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(vertexPositionAttribute);

    vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
    gl.enableVertexAttribArray(vertexColorAttribute);
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

function setMatrixUniforms() {
    var pUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    gl.uniformMatrix4fv(pUniform, false, new Float32Array(perspectiveMatrix.flatten()));

    var mvUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    gl.uniformMatrix4fv(mvUniform, false, new Float32Array(mvMatrix.flatten()));
}