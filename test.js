const fs = require("fs");
const sysPath = require("path");
const eachOfLimit = require("async/eachOfLimit");

const ExportsParser = require("./src/ExportsParser");
const EnumParser = require("./src/EnumParser");
const options = require("./src/options");
const {convertExpression} = require("./src/autoit-expression-converter");

console.log(convertExpression("~1"));
console.log(convertExpression("DEPTH_MASK_ALL & ~DEPTH_MASK_8S"));
console.log(convertExpression("1 + 2 * 3 | 4"));
console.log(convertExpression("1 << 2 * 3 << 4"));
console.log(convertExpression("1 << 2 * 3 + 4"));
console.log(convertExpression("(1 << 2) * 3 + 4"));
console.log(convertExpression("Func(1 << 2) * 3 + 4"));
console.log(convertExpression("Func(1 << 2) * Func(3 + 4)"));

[
    "CVAPI(void) VectorOfDoublePushVector(std::vector< double >* v, std::vector< double >* other);",
    "CVAPI(std::vector< double >*) VectorOfDoubleCreate();",
    "CVAPI(void) VectorOfDoubleGetItemPtr(std::vector<  double >* vec, int index,  double** element);",
    "CVAPI(void) setPlane3D(Plane3D* plane, const CvPoint3D64f* unitNormal, const CvPoint3D64f* pointInPlane);",
    "CVAPI(void) VectorOfDMatchPushMatrix(std::vector<cv::DMatch>* matches, const CvMat* trainIdx, const CvMat* distance = 0, const CvMat* mask = 0);",
    "CVAPI(std::vector< unsigned char >*) VectorOfByteCreateSize(int size);",
    "CVAPI(void) cudaCartToPolar(cv::_InputArray* x, cv::_InputArray* y, cv::_OutputArray* magnitude, cv::_OutputArray* angle, bool angleInDegrees, cv::cuda::Stream* stream);",
    "CVAPI(void) cveDetectorParametersSetMinGroupSize(cv::mcc::DetectorParameters* obj, unsigned value);     ",
    `CVAPI(void) OpenniGetColorPoints(
                                 CvCapture* capture, // must be an openni capture
                                 std::vector<ColorPoint>* points, // sequence of ColorPoint
                                 IplImage* mask // CV_8UC1
                                 );`,
    "CVAPI(void) cveAlphamatInfoFlow(cv::_InputArray* image, cv::_InputArray* tmap, cv::_OutputArray* result);",
    "CVAPI(cv::mcc::TYPECHART) cveCCheckerGetTarget(cv::mcc::CChecker* obj);",
    "CVAPI(void) cveCCheckerSetTarget(cv::mcc::CChecker* obj, cv::mcc::TYPECHART value);",
].forEach(expr => {
    const parser = new ExportsParser(false, options);
    parser.parse(expr, 0);
    console.log(parser.returnType, parser.name, parser.args);
});

[
    "CV_EXPORTS_W int waitKey(int delay = 0);",
    `CV_EXPORTS_W void resize( InputArray src, OutputArray dst,
                          Size dsize, double fx = 0, double fy = 0,
                          int interpolation = INTER_LINEAR );`,
    `CV_EXPORTS_W void accumulateWeighted( InputArray src, InputOutputArray dst,
                                      double alpha, InputArray mask = noArray() );`,
    `CV_EXPORTS_W void add(InputArray src1, InputArray src2, OutputArray dst,
                      InputArray mask = noArray(), int dtype = -1);`,
    "CV_EXPORTS_W double PSNR(InputArray src1, InputArray src2, double R=255.);",
    `CV_EXPORTS_W void minMaxLoc(InputArray src, CV_OUT double* minVal,
                            CV_OUT double* maxVal = 0, CV_OUT Point* minLoc = 0,
                            CV_OUT Point* maxLoc = 0, InputArray mask = noArray());`,
    "CV_EXPORTS_W void setIdentity(InputOutputArray mtx, const Scalar& s = Scalar(1));",
    `CV_EXPORTS_W void drawKeypoints( InputArray image, const std::vector<KeyPoint>& keypoints, InputOutputArray outImage,
                               const Scalar& color=Scalar::all(-1), DrawMatchesFlags flags=DrawMatchesFlags::DEFAULT );`,
].forEach(expr => {
    const parser = new ExportsParser(false, options);
    expr = expr.replace(/CV_(?:IN|OUT|IN_OUT) /g, "").replace(/CV_EXPORTS_W inline/g, "CV_NOT_EXPORTS_W");
    parser.options.exports.start = "CV_EXPORTS_W ";
    parser.options.exports.end = " ";
    parser.init(parser.options);
    parser.parse(expr, 0);
    console.log(parser.returnType, parser.name, parser.args);
});

eachOfLimit([
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\imgproc\\include\\opencv2\\imgproc.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\features2d\\include\\opencv2\\features2d.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\calib3d\\include\\opencv2\\calib3d.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\mat.hpp"),
], 1, (localFile, i, next) => {
    const parser = new ExportsParser(true, options);
    parser.options.exports.start = "CV_EXPORTS_W ";
    parser.options.exports.end = " ";
    parser.init(parser.options);

    fs.readFile(localFile, (err, buffer) => {
        if (err) {
            next(err.code === "ENOENT" ? null : err);
            return;
        }
        buffer = buffer.toString().replace(/CV_(?:IN|OUT|IN_OUT) /g, "").replace(/CV_EXPORTS_W inline/g, "CV_NOT_EXPORTS_W");
        const api = parser.parseFile(buffer);

        if (parser.lastError) {
            console.log("reading", localFile, "error");
            next(parser.lastError);
            return;
        }

        for (const [returnType, name, args] of api) {
            console.log(returnType, name, args);
        }

        next();
    });
}, err => {
    if (err) {
        throw err;
    }
});

[
    `GDK_PIXBUF_AVAILABLE_IN_ALL
GType               gdk_pixbuf_animation_get_type        (void) G_GNUC_CONST;`,
    `GDK_PIXBUF_AVAILABLE_IN_ALL
gboolean gdk_pixbuf_save           (GdkPixbuf  *pixbuf,
                                    const char *filename,
                                    const char *type,
                                    GError    **error,
                                    ...) G_GNUC_NULL_TERMINATED;`,
    `GLIB_AVAILABLE_IN_ALL
void                    g_application_command_line_print                (GApplicationCommandLine   *cmdline,
                                                                         const gchar               *format,
                                                                         ...) G_GNUC_PRINTF(2, 3);`,
    `GLIB_AVAILABLE_IN_ALL
void                    g_settings_backend_flatten_tree                 (GTree               *tree,
                                                                         gchar              **path,
                                                                         const gchar       ***keys,
                                                                         GVariant          ***values);`,
    `GLIB_AVAILABLE_IN_ALL
gint                    g_atomic_int_get                      (const volatile gint *atomic);`,
    `GLIB_AVAILABLE_IN_ALL
void      g_key_file_set_string_list        (GKeyFile             *key_file,
                         const gchar          *group_name,
                         const gchar          *key,
                         const gchar * const   list[],
                         gsize                 length);`,
    `GLIB_AVAILABLE_IN_ALL
gchar*               g_strdup_printf  (const gchar *format,
                    ...) G_GNUC_PRINTF (1, 2) G_GNUC_MALLOC;`,
    `GLIB_AVAILABLE_IN_ALL
const GVariantType *            g_variant_type_checked_                 (const gchar *);`,
    `GLIB_AVAILABLE_IN_ALL
const gchar * const * g_win32_get_system_data_dirs_for_module (void (*address_of_function)(void));`,
].forEach(expr => {
    const parser = new ExportsParser(false, Object.assign({
        mayBeEnd() {
            this.mayBeSpace();
            while (this.input.startsWith("G_GNUC_", this.pos) || this.input.startsWith("G_ANALYZER_NORETURN", this.pos)) {
                const notWordReg = /\W/mg;
                notWordReg.lastIndex = this.pos;
                let match = notWordReg.exec(this.input);
                if (match === null) {
                    this.pos = this.input.length;
                } else {
                    this.pos = match.index;
                    this.mayBeSpace();
                    if (this.input[this.pos] === "(") {
                        match = this.input.indexOf(")", this.pos + 1);
                        if (match !== -1) {
                            this.pos = match + 1;
                        }
                    }
                }
                this.mayBeSpace();
            }
        }
    }, options));
    parser.options.exports.start = /^\w+_AVAILABLE_IN_ALL\s+/mg;
    parser.options.exports.end = " ";
    parser.init(parser.options);
    parser.parse(expr, 0);
    console.log(parser.returnType, parser.name, parser.args);
});

eachOfLimit([
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\gdk-pixbuf-2.0\\gdk-pixbuf\\gdk-pixbuf-animation.h",
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\gdk-pixbuf-2.0\\gdk-pixbuf\\gdk-pixbuf-core.h",
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\glib-2.0\\gio\\gapplicationcommandline.h",
], 1, (localFile, i, next) => {
    const parser = new ExportsParser(true, Object.assign({
        mayBeEnd() {
            this.mayBeSpace();
            if (this.input.startsWith("G_GNUC_", this.pos)) {
                const notWordReg = /\W/mg;
                notWordReg.lastIndex = this.pos;
                let match = notWordReg.exec(this.input);
                if (match === null) {
                    this.pos = this.input.length;
                } else {
                    this.pos = match.index;
                    this.mayBeSpace();
                    if (this.input[this.pos] === "(") {
                        match = this.input.indexOf(")", this.pos + 1);
                        if (match !== -1) {
                            this.pos = match + 1;
                        }
                    }
                }
            }
        }
    }, options));
    parser.options.exports.start = /^\w+_AVAILABLE_IN_ALL\s+/mg;
    parser.options.exports.end = " ";
    parser.init(parser.options);

    fs.readFile(localFile, (err, buffer) => {
        if (err) {
            next(err.code === "ENOENT" ? null : err);
            return;
        }

        const api = parser.parseFile(buffer);

        if (parser.lastError) {
            console.log("reading", localFile, "error");
            next(parser.lastError);
            return;
        }

        for (const [returnType, name, args] of api) {
            console.log(returnType, name, args);
        }

        next();
    });
}, err => {
    if (err) {
        throw err;
    }
});

eachOfLimit([
    sysPath.join(__dirname, "emgucv\\Emgu.CV.Extern\\depthai-core\\shared\\depthai-shared\\include\\depthai-shared\\metadata\\camera_control.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\calib3d\\include\\opencv2\\calib3d.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\affine.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\base.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\check.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\cuda.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\cuda\\detail\\type_traits_detail.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\mat.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\core\\include\\opencv2\\core\\types.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\features2d\\include\\opencv2\\features2d.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\imgcodecs\\include\\opencv2\\imgcodecs.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv\\modules\\imgproc\\include\\opencv2\\imgproc.hpp"),
    sysPath.join(__dirname, "emgucv\\opencv_contrib\\modules\\ximgproc\\include\\opencv2\\ximgproc\\weighted_median_filter.hpp"),
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\glib-2.0\\gio\\gioenums.h",
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\gdk-pixbuf-2.0\\gdk-pixbuf\\gdk-pixbuf-core.h",
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\glib-2.0\\glib\\gvariant.h",
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\cairo\\cairo.h",
    "C:\\gtk-build\\gtk-4.3.2\\x64\\release\\include\\pango-1.0\\pango\\pango-layout.h",
], 1, (localFile, i, next) => {
    const parser = new EnumParser();

    fs.readFile(localFile, (err, buffer) => {
        if (err) {
            next(err.code === "ENOENT" ? null : err);
            return;
        }

        const ast = parser.parse(buffer);

        if (parser.lastError) {
            console.log("reading", localFile, "error");
            next(parser.lastError);
            return;
        }

        console.log(ast.enum);
        next();
    });
}, err => {
    if (err) {
        throw err;
    }
});
