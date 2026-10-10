package com.provacor.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Lets the phone's PDF viewer read a PDF the app has saved (content://com.provacor.app.files/<path>). */
public class Files extends ContentProvider {
    File file(Uri uri) throws FileNotFoundException {
        String path = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/+", "");
        if (path.contains("..") || !path.toLowerCase().endsWith(".pdf")) throw new FileNotFoundException(path);
        File f = new File(new File(getContext().getFilesDir(), "web"), path);
        if (!f.isFile()) throw new FileNotFoundException(path);
        return f;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        try {
            File f = file(uri);
            MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            c.addRow(new Object[]{f.getName(), f.length()});
            return c;
        } catch (FileNotFoundException e) {
            return null;
        }
    }

    @Override public String getType(Uri uri) { return "application/pdf"; }
    @Override public boolean onCreate() { return true; }
    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
