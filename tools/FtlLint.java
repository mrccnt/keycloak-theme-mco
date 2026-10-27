// FreeMarker syntax check for the theme templates.
//
// Parses every given .ftl file with the same FreeMarker version and settings
// Keycloak uses (2.3.32, HTML auto-escaping), without rendering anything.
// Usage: java -cp freemarker.jar tools/FtlLint.java <file.ftl>...

import freemarker.core.HTMLOutputFormat;
import freemarker.core.ParseException;
import freemarker.template.Configuration;
import freemarker.template.Template;

import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public class FtlLint {

    public static void main(String[] args) throws Exception {
        Configuration cfg = new Configuration(Configuration.VERSION_2_3_32);
        cfg.setDefaultEncoding("UTF-8");
        cfg.setOutputFormat(HTMLOutputFormat.INSTANCE);

        int errors = 0;
        for (String arg : args) {
            Path file = Path.of(arg);
            try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
                new Template(file.toString(), reader, cfg);
            } catch (ParseException e) {
                errors++;
                System.err.printf("%s:%d:%d: %s%n", file, e.getLineNumber(), e.getColumnNumber(), e.getEditorMessage());
            }
        }

        System.out.printf("ftl-lint: %d file(s) checked, %d error(s)%n", args.length, errors);
        System.exit(errors == 0 ? 0 : 1);
    }
}
