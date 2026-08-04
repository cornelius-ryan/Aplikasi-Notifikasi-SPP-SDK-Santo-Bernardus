// 2. Fungsi Membaca dan Menyimpan File CSV ke Supabase
async function uploadCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Membaca isi file teks
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const baris = text.split("\n"); // Memisahkan data per baris (Enter)
        const dataSiswaBaru = [];

        // Mulai looping dari indeks 1 untuk melewati baris Header
        for (let i = 1; i < baris.length; i++) {
            if (baris[i].trim() === "") continue; // Lewati baris yang kosong di akhir file
            
            const kolom = baris[i].split(","); // Memisahkan data per koma
            
            if (kolom.length >= 5) {
                dataSiswaBaru.push({
                    nis: kolom[0].trim(),
                    nama: kolom[1].trim(),
                    kode_kelas: kolom[2].trim(),
                    no_wa_ortu: kolom[3].trim(),
                    nominal_spp: Number(kolom[4].trim())
                });
            }
        }

        if (dataSiswaBaru.length > 0) {
            const konfirmasi = confirm(`Terbaca ${dataSiswaBaru.length} data siswa dari file. Lanjutkan simpan ke database?`);
            if (konfirmasi) {
                // Proses Bulk Insert ke Supabase
                const { data, error } = await db.from('siswa').insert(dataSiswaBaru);
                
                if (error) {
                    // Biasa error jika ada NIS yang kembar (karena NIS kita set UNIQUE di awal)
                    alert("Gagal mengimpor data: " + error.message);
                } else {
                    alert("Berhasil mengimpor seluruh data siswa!");
                    muatDataSiswa(); // Refresh tabel otomatis setelah import sukses
                }
            }
        } else {
            alert("Tidak ada data yang valid untuk diimpor. Pastikan format CSV dipisahkan oleh koma.");
        }
        
        event.target.value = ''; // Reset input file agar bisa upload file yang sama lagi jika perlu
    };
    reader.readAsText(file);
}
