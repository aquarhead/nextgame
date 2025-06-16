pub fn hex_string() -> String {
  use sha3::{
    Shake128,
    digest::{ExtendableOutput, Update, XofReader},
  };
  let mut buf = [0u8; 32];
  getrandom::fill(&mut buf).unwrap();

  let mut hasher = Shake128::default();
  hasher.update(&buf);
  let mut reader = hasher.finalize_xof();
  let mut res1 = [0u8; 10];
  reader.read(&mut res1);
  hex::encode(res1)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn validate_hex_str() {
    let hs = hex_string();
    assert_eq!(hs.len(), 20);
  }
}
