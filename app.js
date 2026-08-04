// app.js

// 1. Inisialisasi Koneksi ke Supabase
const SUPABASE_URL = 'https://xlgnbgjlxpfukyredibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ25iZ2pseHBmdWt5cmVkaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MDQ4NDMsImV4cCI6MjEwMTM4MDg0M30.-6XK60RL0kz2U2diE5V8-Niphg2X1dWk8eIKvMB3_NY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabel Global untuk Antrean
let daftarAntrean = [];
let indeksSaatIni = 0;

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const tombol = document.querySelector('#login-section button');
    
    console.log("Tombol masuk diklik, memproses email:", email);
    tombol.innerText = 'Memproses...';
    document.getElementById('pesan-error').innerText = '';

    const { data, error } = await db.auth.signInWithPassword({ email: email, password: password });

    if (error) {
        console.error("Error login:", error.message);
        document.getElementById('pesan-error').innerText = "Login gagal: " + error.message;
        tombol.innerText = 'Masuk';
    } else {
        console.log("Login auth berhasil, user ID:", data.user.id);
        tampilkanDashboard(data.user.id);
    }
}

async function tampilkanDashboard(userId) {
    console.log("Masuk ke fungsi tampilkanDashboard untuk ID:", userId);
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';

    // Tarik Profil
    const { data: profil, error: errorProfil } = await db.from('profiles').select('*').eq('id', userId).single();
    
    if (errorProfil || !profil) {
        console.error("Gagal ambil profil:", errorProfil ? errorProfil.message : "Profil tidak ditemukan di database!");
        alert("Gagal memuat profil pengguna dari database. Pastikan akun ini sudah terdaftar di tabel profiles.");
        return;
    }

    console.log("Profil berhasil dimuat:", profil);
    document.getElementById('nama-user').innerText = profil.nama;
    document.getElementById('role-user').innerText = profil.role.toUpperCase();

    // Atur Tampilan Berdasarkan Role
    if (profil.role === 'admin') {
        document.getElementById('btn-menu-tagihan').style.display = 'block';
        document.getElementById('btn-menu-siswa').style.display = 'block';
        document.getElementById('btn-menu-guru').style.display = 'block';
        document.getElementById('panel-guru').style.display = 'none';
        
        muatStatistikDashboard(); 
        muatDataTagihan('BELUM_BAYAR'); 
    } else {
        document.getElementById('btn-menu-tagihan').style.display = 'none';
        document.getElementById('panel-guru').style.display = 'block';
        
        const { data: siswa } = await db.from('siswa').select('*');
        const listSiswa = document.getElementById('daftar-siswa');
        listSiswa.innerHTML = '';
        if(siswa) {
            siswa.forEach(s => listSiswa.innerHTML += `<li>[${s.kode_kelas}] ${s.nama} - NIS: ${s.nis}</li>`);
        }
    }

    bukaMenu('page-home');
}

// Fungsi untuk memuat tabel berdasarkan status (LUNAS / BELUM_BAYAR)
async function muatDataTagihan(statusTarget = 'BELUM_BAYAR') {
    const { data, error } = await db.from('tagihan_spp')
        .select(`id, bulan_tagihan, nominal, status, siswa ( nama, kode_kelas, no_wa_ortu )`)
        .eq('status', statusTarget)
        .order('bulan_tagihan', { ascending: false });

    const tbody = document.getElementById('tabel-tunggakan');
    tbody.innerHTML = '';
    
    document.getElementById('check-all').disabled = (statusTarget === 'LUNAS');
    
    if(data) {
        data.forEach(row => {
            let tombolAksi = '';
            let kotakCentang = '';
            let warnaStatus = statusTarget === 'LUNAS' ? '#4CAF50' : '#ff9800';

            if (statusTarget === 'BELUM_BAYAR') {
                tombolAksi = `<button onclick="ubahStatusTagihan('${row.id}', 'LUNAS')" style="background-color: #4CAF50; color: white; padding: 6px 12px; font-size: 12px; margin: 0;">Tandai Lunas</button>`;
                kotakCentang = `<input type="checkbox" class="chk-item" data-nama="${row.siswa.nama}" data-wa="${row.siswa.no_wa_ortu}" data-nominal="${row.nominal}" data-bulan="${row.bulan_tagihan}">`;
            } else {
                tombolAksi = `<button onclick="ubahStatusTagihan('${row.id}', 'BELUM_BAYAR')" style="background-color: #f44336; color: white; padding: 6px 12px; font-size: 12px; margin: 0;">Batal Lunas</button>`;
                kotakCentang = `<input type="checkbox" disabled>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center;">${kotakCentang}</td>
                    <td>${row.siswa.nama}</td>
                    <td>${row.siswa.kode_kelas}</td>
                    <td>${row.bulan_tagihan}</td>
                    <td>Rp${row.nominal.toLocaleString('id-ID')}</td>
                    <td><span style="background-color: ${warnaStatus}; color: white; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${statusTarget}</span></td>
                    <td>${tombolAksi}</td>
                </tr>
            `;
        });
    }
}

// Fungsi untuk mengeksekusi perubahan status ke Database Supabase
async function ubahStatusTagihan(idTagihan, statusBaru) {
    let pesanKonfirmasi = statusBaru === 'LUNAS' 
        ? 'Apakah Anda yakin tagihan ini SUDAH DIBAYAR?' 
        : 'AWAS! Batalkan status lunas dan kembalikan ke MENUNGGAK?';
        
    if (!confirm(pesanKonfirmasi)) return;

    const tanggalBayar = statusBaru === 'LUNAS' ? new Date().toISOString() : null;

    const { error } = await db.from('tagihan_spp')
        .update({ status: statusBaru, tanggal_bayar: tanggalBayar })
        .eq('id', idTagihan);

    if (error) {
        alert("Gagal memperbarui data: " + error.message);
    } else {
        const statusSedangDilihat = statusBaru === 'LUNAS' ? 'BELUM_BAYAR' : 'LUNAS';
        muatDataTagihan(statusSedangDilihat);
    }
}

function centangSemua() {
    const master = document.getElementById('check-all').checked;
    document.querySelectorAll('.chk-item').forEach(chk => chk.checked = master);
}

function siapkanAntrean() {
    daftarAntrean = []; 
    indeksSaatIni = 0;
    
    const mapAntrean = new Map();

    document.querySelectorAll('.chk-item:checked').forEach(chk => {
        const nama = chk.dataset.nama;
        const wa = chk.dataset.wa;
        const nominal = Number(chk.dataset.nominal); 
        const bulan = chk.dataset.bulan;

        if (mapAntrean.has(wa)) {
            const dataSiswa = mapAntrean.get(wa);
            dataSiswa.nominal += nominal;
            dataSiswa.bulan.push(bulan);
        } else {
            mapAntrean.set(wa, { nama: nama, wa: wa, nominal: nominal, bulan: [bulan] });
        }
    });

    daftarAntrean = Array.from(mapAntrean.values());

    if (daftarAntrean.length === 0) {
        alert("Silakan centang minimal satu siswa terlebih dahulu.");
        return;
    }

    document.getElementById('antrean-panel').style.display = 'block';
    updateLayarAntrean();
}

function updateLayarAntrean() {
    const statusText = document.getElementById('status-antrean');
    const btnKirim = document.getElementById('btn-kirim-wa');

    if (indeksSaatIni < daftarAntrean.length) {
        const target = daftarAntrean[indeksSaatIni];
        statusText.innerHTML = `Mengirim pesan <b>${indeksSaatIni + 1} dari ${daftarAntrean.length}</b><br>Tujuan: <b>${target.nama}</b> (${target.wa})`;
        btnKirim.innerText = `Kirim Pesan ke-${indeksSaatIni + 1}`;
        btnKirim.style.display = 'inline-block';
    } else {
        statusText.innerHTML = `<span style="color: green; font-weight: bold;">Selesai!</span> Semua pesan dalam antrean sudah diproses.`;
        btnKirim.style.display = 'none';
    }
}

function kirimWaSekarang() {
    const target = daftarAntrean[indeksSaatIni];
    const daftarBulan = target.bulan.join(' dan ');
    
    const teksPesan = `Halo Bapak/Ibu Wali Murid dari *${target.nama}*,\n\nIni adalah pengingat dari sekolah bahwa terdapat tagihan SPP bulan *${daftarBulan}* dengan total sebesar *Rp${target.nominal.toLocaleString('id-ID')}* yang belum diselesaikan.\n\nMohon untuk segera melakukan pembayaran. Terima kasih.`;
    const linkWa = `https://wa.me/${target.wa}?text=${encodeURIComponent(teksPesan)}`;
    
    window.open(linkWa, '_blank');
    indeksSaatIni++;
    updateLayarAntrean();
}

function batalAntrean() {
    document.getElementById('antrean-panel').style.display = 'none';
    daftarAntrean = [];
}

async function logout() {
    await db.auth.signOut();
    window.location.reload();
}

function bukaMenu(idHalaman) {
    document.querySelectorAll('.halaman').forEach(hal => hal.classList.remove('aktif'));
    document.getElementById(idHalaman).classList.add('aktif');

    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('menu-aktif'));
    
    if (idHalaman === 'page-home') {
        document.getElementById('btn-menu-home').classList.add('menu-aktif');
        muatStatistikDashboard();
    }
    if (idHalaman === 'page-tagihan') {
        document.getElementById('btn-menu-tagihan').classList.add('menu-aktif');
        muatDataTagihan('BELUM_BAYAR');
    }
    if (idHalaman === 'page-siswa') {
        document.getElementById('btn-menu-siswa').classList.add('menu-aktif');
        muatDataSiswa(); 
    }
    if (idHalaman === 'page-guru') {
        document.getElementById('btn-menu-guru').classList.add('menu-aktif');
        muatDataGuru();
    }
}

// ==========================================
// FUNGSI MANAJEMEN DATA SISWA (BULK ADD CSV)
// ==========================================
function downloadFormatCSV() {
    const header = "nis,nama,kode_kelas,no_wa_ortu,nominal_spp\n";
    const contoh = "2026001,Budi Santoso,5-A,6281234567890,150000\n"; 
    
    const csvContent = "data:text/csv;charset=utf-8," + header + contoh;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Format_Import_Siswa_SPP.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function uploadCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const baris = text.split("\n"); 
        const dataSiswaBaru = [];

        for (let i = 1; i < baris.length; i++) {
            if (baris[i].trim() === "") continue; 
            
            const kolom = baris[i].split(","); 
            
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
                const { data, error } = await db.from('siswa').insert(dataSiswaBaru);
                
                if (error) {
                    alert("Gagal mengimpor data: " + error.message);
                } else {
                    alert("Berhasil mengimpor seluruh data siswa!");
                    muatDataSiswa(); 
                }
            }
        } else {
            alert("Tidak ada data yang valid untuk diimpor. Pastikan format CSV dipisahkan oleh koma.");
        }
        
        event.target.value = ''; 
    };
    reader.readAsText(file);
}

async function muatDataSiswa() {
    const { data, error } = await db.from('siswa')
        .select('*')
        .order('kode_kelas', { ascending: true })
        .order('nama', { ascending: true });

    const tbody = document.getElementById('tabel-data-siswa');
    tbody.innerHTML = '';

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data: ${error.message}</td></tr>`;
        return;
    }

    if (data && data.length > 0) {
        data.forEach((s, index) => {
            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center; color: #64748b;">${index + 1}</td>
                    <td style="font-weight: 500;">${s.nis}</td>
                    <td>${s.nama}</td>
                    <td><span style="background-color: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${s.kode_kelas}</span></td>
                    <td>${s.no_wa_ortu}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="bukaFormEdit('${s.id}', '${s.nis}', '${s.nama}', '${s.kode_kelas}', '${s.no_wa_ortu}')" style="background-color: #3b82f6; color: white; padding: 5px 10px; font-size: 12px; border-radius: 4px; border: none; cursor: pointer;">Edit</button>
                            <button onclick="hapusSiswa('${s.id}')" style="background-color: #ef4444; color: white; padding: 5px 10px; font-size: 12px; border-radius: 4px; border: none; cursor: pointer;">Hapus</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b;">Belum ada data siswa. Silakan unggah CSV.</td></tr>`;
    }
}

async function hapusSiswa(idSiswa) {
    if (!confirm("Yakin ingin menghapus siswa ini? Seluruh riwayat tagihannya juga akan ikut terhapus!")) return;

    const { error } = await db.from('siswa').delete().eq('id', idSiswa);

    if (error) {
        alert("Gagal menghapus siswa: " + error.message);
    } else {
        muatDataSiswa(); 
    }
}

// ==========================================
// FUNGSI GENERATOR TAGIHAN BULANAN MASSAL
// ==========================================
async function generateTagihanMassal() {
    const inputBulan = document.getElementById('input-bulan-tagihan').value; 
    if (!inputBulan) {
        alert("Silakan pilih bulan dan tahun tagihan terlebih dahulu.");
        return;
    }

    const bulanTagihanLengkap = inputBulan + "-01";

    const konfirmasi = confirm(`Anda akan membuat tagihan massal untuk periode ${bulanTagihanLengkap.toUpperCase()} bagi SELURUH siswa aktif. Lanjutkan?`);
    if (!konfirmasi) return;

    const { data: listSiswa, error: errorSiswa } = await db.from('siswa').select('id, nominal_spp');

    if (errorSiswa || !listSiswa || listSiswa.length === 0) {
        alert("Gagal memuat data siswa untuk digenerate: " + (errorSiswa ? errorSiswa.message : "Data siswa kosong"));
        return;
    }

    const tagihanBaru = listSiswa.map(s => ({
        siswa_id: s.id,
        bulan_tagihan: bulanTagihanLengkap,
        nominal: s.nominal_spp || 150000, 
        status: 'BELUM_BAYAR'
    }));

    const { data, error } = await db.from('tagihan_spp').insert(tagihanBaru);

    if (error) {
        alert("Gagal generate tagihan: " + error.message + "\n(Kemungkinan tagihan untuk bulan ini sudah pernah dibuat sebelumnya).");
    } else {
        alert(`Berhasil! Tagihan untuk periode ${bulanTagihanLengkap} telah dibuat ke sistem.`);
        muatDataTagihan('BELUM_BAYAR');
    }
}

// ==========================================
// FUNGSI PENCARIAN & FILTER TABEL
// ==========================================
function filterTabelTagihan() {
    const keyword = document.getElementById('cari-tagihan').value.toLowerCase();
    const kelasPilihan = document.getElementById('filter-kelas-tagihan').value;
    const rows = document.querySelectorAll('#tabel-tunggakan tr');

    rows.forEach(row => {
        if (row.cells.length < 3) return; 

        const namaSiswa = row.cells[1].innerText.toLowerCase();
        const kelasSiswa = row.cells[2].innerText;

        const cocokNama = namaSiswa.includes(keyword);
        const cocokKelas = (kelasPilihan === "" || kelasSiswa === kelasPilihan);

        if (cocokNama && cocokKelas) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

function filterTabelSiswa() {
    const keyword = document.getElementById('cari-siswa').value.toLowerCase();
    const rows = document.querySelectorAll('#tabel-data-siswa tr');

    rows.forEach(row => {
        if (row.cells.length < 3) return;

        const nisSiswa = row.cells[1].innerText.toLowerCase();
        const namaSiswa = row.cells[2].innerText.toLowerCase();

        if (nisSiswa.includes(keyword) || namaSiswa.includes(keyword)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

// ==========================================
// FUNGSI EDIT & MUTASI DATA SISWA
// ==========================================
async function bukaFormEdit(id, nis, nama, kelas, wa) {
    document.getElementById('edit-id-siswa').value = id;
    document.getElementById('edit-nis').value = nis;
    document.getElementById('edit-nama').value = nama;
    document.getElementById('edit-kelas').value = kelas;
    document.getElementById('edit-wa').value = wa;

    document.getElementById('form-edit-container').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function tutupFormEdit() {
    document.getElementById('form-edit-container').style.display = 'none';
}

async function simpanPerubahanSiswa() {
    const id = document.getElementById('edit-id-siswa').value;
    const namaBaru = document.getElementById('edit-nama').value;
    const kelasBaru = document.getElementById('edit-kelas').value;
    const waBaru = document.getElementById('edit-wa').value;

    if (!namaBaru || !kelasBaru || !waBaru) {
        alert("Semua kolom wajib diisi!");
        return;
    }

    const { error } = await db.from('siswa')
        .update({ 
            nama: namaBaru, 
            kode_kelas: kelasBaru, 
            no_wa_ortu: waBaru 
        })
        .eq('id', id);

    if (error) {
        alert("Gagal memperbarui data: " + error.message);
    } else {
        alert("Data siswa berhasil diperbarui!");
        tutupFormEdit();
        muatDataSiswa(); 
    }
}

// ==========================================
// FUNGSI STATISTIK DASHBOARD UTAMA
// ==========================================
async function muatStatistikDashboard() {
    const { count: jumlahSiswa } = await db.from('siswa').select('*', { count: 'exact', head: true });
    document.getElementById('stat-total-siswa').innerText = jumlahSiswa || 0;

    const { count: jumlahBelumBayar } = await db.from('tagihan_spp').select('*', { count: 'exact', head: true }).eq('status', 'BELUM_BAYAR');
    document.getElementById('stat-total-tunggakan').innerText = jumlahBelumBayar || 0;

    const { count: jumlahLunas } = await db.from('tagihan_spp').select('*', { count: 'exact', head: true }).eq('status', 'LUNAS');
    document.getElementById('stat-total-lunas').innerText = jumlahLunas || 0;
}

// ==========================================
// FUNGSI MANAJEMEN DATA GURU
// ==========================================
async function muatDataGuru() {
    // Tarik data dari tabel profiles
    const { data, error } = await db.from('profiles')
        .select('*')
        .order('nama', { ascending: true });

    const tbody = document.getElementById('tabel-data-guru');
    tbody.innerHTML = '';

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat data guru: ${error.message}</td></tr>`;
        return;
    }

    if (data && data.length > 0) {
        data.forEach((g, index) => {
            let badgeRole = g.role === 'admin' 
                ? '<span style="background-color: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">ADMIN</span>' 
                : '<span style="background-color: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">GURU / WALI KELAS</span>';

            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center; color: #64748b;">${index + 1}</td>
                    <td style="font-weight: 500;">${g.nama || '-'}</td>
                    <td>${g.email || '-'}</td>
                    <td>${badgeRole}</td>
                    <td>
                        <span style="color: #64748b; font-size: 13px; font-style: italic;">Sistem Aktif</span>
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">Belum ada data guru/profil terdaftar.</td></tr>`;
    }
}
