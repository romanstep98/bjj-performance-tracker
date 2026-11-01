package cz.builttoroll.app;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;

public class BackupFilesTest {
    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }

    public static void main(String[] args) throws Exception {
        byte[] original = "{\"name\":\"Roman Štěpánek\",\"sessions\":[]}".getBytes(StandardCharsets.UTF_8);
        // Android providers may report size/available as zero while data exists.
        ByteArrayInputStream provider = new ByteArrayInputStream(original) {
            @Override public synchronized int available() { return 0; }
            @Override public synchronized int read(byte[] b, int off, int len) {
                return super.read(b, off, Math.min(len, 3));
            }
        };
        check(Arrays.equals(original, BackupFiles.read(provider, original.length)), "Read every byte from partial provider chunks");
        try {
            BackupFiles.read(new ByteArrayInputStream(new byte[0]), 1024);
            throw new AssertionError("Empty input accepted");
        } catch (IOException expected) { check(expected.getMessage().contains("prázdný"), "Explain empty backup"); }
        try {
            BackupFiles.read(new ByteArrayInputStream(original), original.length - 1);
            throw new AssertionError("Oversized input accepted");
        } catch (IOException expected) { }

        File directory = Files.createTempDirectory("bjj-backup-test").toFile();
        File staging = new File(directory, "backup-export.pending");
        try {
            BackupFiles.stage(staging, original, original.length);
            // Recreate every in-memory reference, as happens after process death.
            try (FileInputStream afterRestart = new FileInputStream(new File(directory, "backup-export.pending"))) {
                check(Arrays.equals(original, BackupFiles.read(afterRestart, original.length)), "Staged export survives process recreation");
            }
            try {
                BackupFiles.stage(staging, new byte[0], original.length);
                throw new AssertionError("Empty staging accepted");
            } catch (IOException expected) { }
            check(Arrays.equals(original, Files.readAllBytes(staging.toPath())), "Invalid export preserves previous staged bytes");
            byte[] replacement = "{}".getBytes(StandardCharsets.UTF_8);
            BackupFiles.stage(staging, replacement, 1024);
            check(Arrays.equals(replacement, Files.readAllBytes(staging.toPath())), "Replacement has no leftover trailing bytes");
            check(!new File(staging.getPath() + ".tmp").exists(), "Temporary file cleaned up");
        } finally {
            staging.delete();
            directory.delete();
        }
        System.out.println("PASS: provider chunks, zero metadata, empty/oversized inputs, durable export after restart, safe staged replacement.");
    }
}
