import java.io.BufferedReader;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.Source;
import javax.xml.transform.Result;
import javax.xml.transform.stream.StreamSource;
import javax.xml.transform.sax.SAXResult;

import org.apache.fop.apps.Fop;
import org.apache.fop.apps.FopConfParser;
import org.apache.fop.apps.FopFactory;
import org.apache.fop.apps.MimeConstants;

/**
 * A long-lived FOP renderer. Keeping the JVM (and FOP's class loading + font
 * cache) warm removes the ~1.7s cold-start paid by fop.bat on every build.
 *
 * Protocol: one request per line on stdin, tab-separated
 *     baseDir \t foPath \t pdfPath
 * The reply is a single line on stdout: "OK" or "ERR: <message>".
 * A base URI is set per request so images referenced relatively in the FO
 * resolve against that project's folder. The font cache persists to disk, so
 * only the first render pays detection cost.
 *
 * args[0], when given, is the path to fop.xconf. It registers the bundled
 * DejaVu Sans fallback, and the fop launcher is handed the same file via -c:
 * configure only one of the two and whether a character outside the base-14
 * WinAnsi set renders would depend on whether this daemon happened to be warm.
 */
public class FopServer {
    public static void main(String[] args) throws Exception {
        File userConfig = null;
        if (args.length > 0 && !args[0].isEmpty()) {
            File f = new File(args[0]);
            // Missing config is not fatal: fall back to base-14 fonts, exactly
            // as this server behaved before the file existed. A malformed one
            // IS fatal, and should be — it means the shipped config is broken.
            if (f.isFile()) userConfig = f;
        }

        // Silence FOP's per-page "Rendered page #N" INFO chatter; keep warnings.
        java.util.logging.Logger.getLogger("org.apache.fop").setLevel(java.util.logging.Level.WARNING);

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        PrintStream out = new PrintStream(System.out, true, "UTF-8");
        TransformerFactory tf = TransformerFactory.newInstance();

        // Signal readiness so the Node side knows the JVM is up.
        out.println("READY");

        String line;
        while ((line = in.readLine()) != null) {
            if (line.trim().isEmpty()) continue;
            if (line.equals("PING")) { out.println("OK"); continue; }
            if (line.equals("QUIT")) break;

            String[] parts = line.split("\t", 3);
            if (parts.length != 3) { out.println("ERR: bad request"); continue; }
            String baseDir = parts[0], foPath = parts[1], pdfPath = parts[2];

            OutputStream pdf = null;
            try {
                // The base URI stays per-request (relative image paths resolve
                // against the project folder), with the font configuration
                // layered on top of it.
                java.net.URI base = new File(baseDir).toURI();
                FopFactory fopFactory = userConfig == null
                        ? FopFactory.newInstance(base)
                        : new FopConfParser(userConfig, base).getFopFactoryBuilder().build();
                pdf = new BufferedOutputStream(new FileOutputStream(pdfPath));
                Fop fop = fopFactory.newFop(MimeConstants.MIME_PDF, pdf);
                Transformer transformer = tf.newTransformer();
                Source src = new StreamSource(new File(foPath));
                Result res = new SAXResult(fop.getDefaultHandler());
                transformer.transform(src, res);
                pdf.close();
                pdf = null;
                out.println("OK");
            } catch (Throwable t) {
                if (pdf != null) { try { pdf.close(); } catch (Exception ignore) {} }
                String msg = t.getMessage();
                out.println("ERR: " + (msg == null ? t.toString() : msg.replace('\n', ' ')));
            }
        }
    }
}
