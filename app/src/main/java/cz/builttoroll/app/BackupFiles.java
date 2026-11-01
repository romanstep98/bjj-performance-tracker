package cz.builttoroll.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

/** Bounded byte I/O; deliberately independent of WebView and provider metadata. */
public final class BackupFiles {
    public static final int MAX_BACKUP_BYTES = 10 * 1024 * 1024;
    public static final int MAX_EXPORT_BYTES = 20 * 1024 * 1024;

    private BackupFiles() { }

    public static byte[] read(InputStream in, int maxBytes) throws IOException {
        if (in == null) throw new IOException("Soubor nelze otevřít.");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = in.read(buffer)) != -1) {
            if (count == 0) {
                int one = in.read();
                if (one == -1) break;
                if (out.size() >= maxBytes) throw new IOException("Soubor je příliš velký.");
                out.write(one);
                continue;
            }
            if (out.size() > maxBytes - count) throw new IOException("Soubor je příliš velký.");
            out.write(buffer, 0, count);
        }
        if (out.size() == 0) throw new IOException("Soubor je prázdný (0 B). Vyber jinou zálohu nebo ji exportuj z původní aplikace znovu.");
        return out.toByteArray();
    }

    /** Stage before opening the picker, surviving activity/process recreation. */
    public static void stage(File destination, byte[] bytes, int maxBytes) throws IOException {
        if (bytes == null || bytes.length == 0 || bytes.length > maxBytes)
            throw new IOException("Prázdný nebo příliš velký soubor nelze uložit.");
        File temporary = new File(destination.getPath() + ".tmp");
        try {
            try (FileOutputStream out = new FileOutputStream(temporary)) {
                out.write(bytes);
                out.getFD().sync();
            }
            Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } finally {
            temporary.delete();
        }
    }
}
